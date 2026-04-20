export function isMissingCollectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    /\bPostman API 404\b/.test(err.message) ||
    err.message.includes('instanceNotFoundError') ||
    err.message.includes('could not find the collection')
  );
}

