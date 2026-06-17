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
 *   - [PASS] shows coming-soon text without JS errors when navigating to /history
 */
test.describe("Navigation — /history", () => {
  test("shows coming-soon text without JS errors when navigating to /history", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/history");
    await expect(page.getByText("coming soon")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /quality
 * @target      QualityPage renders coming-soon placeholder without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows coming-soon text without JS errors when navigating to /quality
 */
test.describe("Navigation — /quality", () => {
  test("shows coming-soon text without JS errors when navigating to /quality", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/quality");
    await expect(page.getByText("coming soon")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});

/**
 * @test-suite  Navigation — /settings
 * @target      SettingsPage renders coming-soon placeholder without JS errors
 * @strategy    e2e, browser workflow
 * @cases
 *   - [PASS] shows coming-soon text without JS errors when navigating to /settings
 */
test.describe("Navigation — /settings", () => {
  test("shows coming-soon text without JS errors when navigating to /settings", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/settings");
    await expect(page.getByText("coming soon")).toBeVisible();
    expect(errors).toHaveLength(0);
  });
});
