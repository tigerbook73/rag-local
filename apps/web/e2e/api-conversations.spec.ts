/**
 * @test-file   Conversations API
 * @description e2e tests for Conversations CRUD — POST / GET / PATCH / DELETE (requires API running)
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { test, expect } from "@playwright/test";

const API_BASE = `http://localhost:${process.env["TEST_API_PORT"] ?? "3001"}/api/v1`;

/**
 * @test-suite  POST /conversations
 * @target      conversation creation returns id and createdAt
 * @strategy    e2e, API request, no browser UI
 * @cases
 *   - [PASS] returns 201 with id and createdAt when creating a conversation
 */
test.describe("POST /conversations", () => {
  test("returns 201 with id and createdAt when creating a conversation", async ({ request }) => {
    const res = await request.post(`${API_BASE}/conversations`);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: expect.any(String), createdAt: expect.any(String) });
  });
});

/**
 * @test-suite  GET /conversations
 * @target      conversation list returns array
 * @strategy    e2e, API request, no browser UI
 * @cases
 *   - [PASS] returns 200 with data array when listing conversations
 */
test.describe("GET /conversations", () => {
  test("returns 200 with data array when listing conversations", async ({ request }) => {
    const res = await request.get(`${API_BASE}/conversations`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

/**
 * @test-suite  PATCH /conversations/:id
 * @target      conversation title update
 * @strategy    e2e, API request, creates then updates a conversation
 * @cases
 *   - [PASS] returns updated title when patching an existing conversation
 */
test.describe("PATCH /conversations/:id", () => {
  test("returns updated title when patching an existing conversation", async ({ request }) => {
    const create = await request.post(`${API_BASE}/conversations`);
    const { id } = (await create.json()) as { id: string };

    const patch = await request.patch(`${API_BASE}/conversations/${id}`, {
      data: { title: "updated title" },
    });
    expect(patch.status()).toBe(200);
    const body = await patch.json();
    expect(body.title).toBe("updated title");
  });
});

/**
 * @test-suite  DELETE /conversations/:id
 * @target      conversation deletion
 * @strategy    e2e, API request, creates then deletes a conversation
 * @cases
 *   - [PASS] returns 204 when deleting an existing conversation
 *   - [FAIL] returns 404 when deleting a non-existent conversation
 */
test.describe("DELETE /conversations/:id", () => {
  test("returns 204 when deleting an existing conversation", async ({ request }) => {
    const create = await request.post(`${API_BASE}/conversations`);
    const { id } = (await create.json()) as { id: string };

    const del = await request.delete(`${API_BASE}/conversations/${id}`);
    expect(del.status()).toBe(204);
  });

  test("returns 404 when deleting a non-existent conversation", async ({ request }) => {
    const res = await request.delete(
      `${API_BASE}/conversations/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status()).toBe(404);
  });
});
