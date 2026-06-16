/**
 * @test-file   Health API
 * @description e2e tests for /health/queue and /health/db endpoint connectivity
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:3001/api/v1";

test('returns { status: "ok" } when queue is reachable', async ({ request }) => {
  const res = await request.get(`${API_BASE}/health/queue`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test('returns { status: "ok" } when database is reachable', async ({ request }) => {
  const res = await request.get(`${API_BASE}/health/db`);
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: "ok" });
});
