/**
 * @test-file   Page Navigation
 * @description e2e tests for route navigation — each page loads without JS errors and shows key content
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { test, expect } from "@playwright/test";

/**
 * @test-suite  Navigation — /chat
 * @target      ChatPage renders with message input
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows message input when navigating to /chat
 */
test.describe("Navigation — /chat", () => {
  test("shows message input when navigating to /chat", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/chat");
    await expect(page.getByRole("textbox")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /knowledge
 * @target      KnowledgePage renders without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] renders 知识库 heading without JS errors when navigating to /knowledge
 */
test.describe("Navigation — /knowledge", () => {
  test("renders 知识库 heading without JS errors when navigating to /knowledge", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/knowledge");
    await expect(page.getByRole("heading", { name: "知识库" })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /history
 * @target      HistoryPage renders coming-soon placeholder without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows 历史记录 heading without JS errors when navigating to /history
 */
test.describe("Navigation — /history", () => {
  test("shows 历史记录 heading without JS errors when navigating to /history", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/history");
    await expect(page.getByText("历史记录")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /quality
 * @target      QualityPage renders without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows 质量评估 heading without JS errors when navigating to /quality
 */
test.describe("Navigation — /quality", () => {
  test("shows 质量评估 heading without JS errors when navigating to /quality", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/quality");
    await expect(page.getByRole("heading", { name: "质量评估" })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /settings
 * @target      SettingsPage renders Query tab without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows Query tab content without JS errors when navigating to /settings
 */
test.describe("Navigation — /settings", () => {
  test("shows Query tab content without JS errors when navigating to /settings", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: "Query" })).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});
