import { readFile } from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';

const PKG_NAME = '@st3ix/pman';

let started = false;

function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const m = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null;
  return { major, minor, patch };
}

function semverIsLess(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return false;
  if (pa.major !== pb.major) return pa.major < pb.major;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor;
  return pa.patch < pb.patch;
}

async function readInstalledVersion(): Promise<string | null> {
  try {
    const u = new URL('../package.json', import.meta.url);
    const raw = await readFile(u, 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    const v = typeof parsed.version === 'string' ? parsed.version.trim() : '';
    return v || null;
  } catch {
    return null;
  }
}

async function fetchLatestVersion(fetchImpl: typeof fetch): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(PKG_NAME)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 1500);
  try {
    const res = await fetchImpl(url, {
      signal: ac.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { 'dist-tags'?: { latest?: unknown } };
    const latest = json?.['dist-tags']?.latest;
    return typeof latest === 'string' && latest.trim() ? latest.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function scheduleUpdateCheck(args: {
  log: FastifyBaseLogger;
  fetchImpl: typeof fetch;
  enabled: boolean;
}): void {
  const { log, fetchImpl, enabled } = args;
  if (!enabled) return;
  if (started) return;
  started = true;

  // Fire-and-forget: must never block startup.
  void (async () => {
    const current = await readInstalledVersion();
    if (!current) return;
    const latest = await fetchLatestVersion(fetchImpl);
    if (!latest) return;
    if (!semverIsLess(current, latest)) return;

    log.info(
      {
        current,
        latest,
        package: PKG_NAME,
        update: `npm i ${PKG_NAME}@latest`,
      },
      'pman: update available',
    );
  })();
}

