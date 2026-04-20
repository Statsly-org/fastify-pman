import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { FastifyPmanOptions } from './options.js';
import { resolvePmanOptions } from './options.js';
import { runPostmanSync } from './sync.js';

const pluginImpl: FastifyPluginAsync<FastifyPmanOptions> = async (fastify, opts) => {
  const resolved = resolvePmanOptions(opts);
  const log = fastify.log;
  const rt = { resolved, log };

  fastify.addHook('onReady', async () => {
    try {
      await runPostmanSync(fastify, rt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(
        { err, message },
        'pman: sync failed (non-fatal). Fix configuration and retry on next start.',
      );
    }
  });
};

export default fp(pluginImpl, {
  fastify: '5.x',
  name: '@st3ix/pman',
});

export type { FastifyPmanOptions } from './options.js';
