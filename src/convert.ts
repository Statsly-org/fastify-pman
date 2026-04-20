import { convert as convertOpenApi } from 'openapi-to-postmanv2';
import type { CollectionResult } from 'openapi-to-postmanv2';

export async function openApiToPostmanCollection(
  openApi: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const input = { type: 'json' as const, data: openApi };
  const result = await new Promise<CollectionResult>((resolve, reject) => {
    convertOpenApi(input, {}, (err, res) => {
      if (err) reject(new Error(err.message));
      else if (!res) reject(new Error('OpenAPI conversion returned no result'));
      else resolve(res);
    });
  });
  if (!result.result) {
    throw new Error(result.reason ?? 'OpenAPI conversion failed');
  }
  const first = result.output?.[0];
  if (!first?.data || typeof first.data !== 'object') {
    throw new Error('OpenAPI conversion produced no collection data');
  }
  return first.data as Record<string, unknown>;
}

