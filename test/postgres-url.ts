/** Returns the same connection URL pointing at another database of the server. */
export function withDatabase(url: string, database: string): string {
  const target = new URL(url);
  target.pathname = `/${database}`;
  return target.toString();
}
