const DEFAULT_REDIS_URL = "redis://localhost:6379";

/** Parse REDIS_URL into BullMQ-compatible connection options. */
export function parseRedisUrl(url = process.env["REDIS_URL"] ?? DEFAULT_REDIS_URL): {
  host: string;
  port: number;
} {
  const { hostname, port } = new URL(url);
  return { host: hostname, port: Number(port || 6379) };
}
