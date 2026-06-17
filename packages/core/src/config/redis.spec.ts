/**
 * @test-file   parseRedisUrl
 * @description unit tests for Redis URL parsing into BullMQ connection options
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect, afterEach } from "vitest";
import { parseRedisUrl, getRedisKeyPrefix } from "./redis.js";

afterEach(() => {
  delete process.env["REDIS_URL"];
  delete process.env["REDIS_KEY_PREFIX"];
});

/**
 * @test-suite  parseRedisUrl
 * @target      Redis URL → { host, port } conversion
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] parses host and port from explicit URL
 *   - [PASS] defaults port to 6379 when URL has no port
 *   - [PASS] reads REDIS_URL env var when no argument is provided
 *   - [PASS] parses localhost URL correctly
 */
describe("parseRedisUrl", () => {
  it("parses host and port from explicit URL", () => {
    expect(parseRedisUrl("redis://redis.internal:6380")).toEqual({
      host: "redis.internal",
      port: 6380,
    });
  });

  it("defaults port to 6379 when URL has no port", () => {
    expect(parseRedisUrl("redis://myhost")).toEqual({ host: "myhost", port: 6379 });
  });

  it("reads REDIS_URL env var when no argument is provided", () => {
    process.env["REDIS_URL"] = "redis://envhost:6381";
    expect(parseRedisUrl()).toEqual({ host: "envhost", port: 6381 });
  });

  it("parses localhost URL correctly", () => {
    expect(parseRedisUrl("redis://localhost:6379")).toEqual({ host: "localhost", port: 6379 });
  });
});

/**
 * @test-suite  getRedisKeyPrefix
 * @target      BullMQ key prefix from REDIS_KEY_PREFIX env var
 * @strategy    unit, no dependencies
 * @cases
 *   - [PASS] returns empty string when REDIS_KEY_PREFIX is not set
 *   - [PASS] returns env var value when REDIS_KEY_PREFIX is set
 */
describe("getRedisKeyPrefix", () => {
  it("returns empty string when REDIS_KEY_PREFIX is not set", () => {
    expect(getRedisKeyPrefix()).toBe("");
  });

  it("returns env var value when REDIS_KEY_PREFIX is set", () => {
    process.env["REDIS_KEY_PREFIX"] = "{e2e}";
    expect(getRedisKeyPrefix()).toBe("{e2e}");
  });
});
