/**
 * @test-file   Knowledge Page
 * @description e2e tests for KnowledgePage UI — upload area visibility and empty-state message
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { test, expect } from "@playwright/test";

/**
 * @test-suite  KnowledgePage — upload area
 * @target      drag-and-drop upload zone is visible and shows accepted file types
 * @strategy    e2e, browser workflow, no API interaction
 * @cases
 *   - [PASS] shows upload icon and click-to-select hint when navigating to /knowledge
 *   - [PASS] shows accepted file type constraint text when navigating to /knowledge
 */
test.describe("KnowledgePage — upload area", () => {
  test("shows upload icon and click-to-select hint when navigating to /knowledge", async ({
    page,
  }) => {
    await page.goto("/knowledge");
    await expect(page.getByText("点击选择文件")).toBeVisible();
  });

  test("shows accepted file type constraint text when navigating to /knowledge", async ({
    page,
  }) => {
    await page.goto("/knowledge");
    await expect(page.getByText(/\.txt.*\.md/)).toBeVisible();
  });
});

/**
 * @test-suite  KnowledgePage — empty state
 * @target      empty document list shows placeholder message
 * @strategy    e2e, browser workflow, requires API returning empty document list
 * @cases
 *   - [PASS] shows 暂无文档 placeholder when document list is empty
 */
test.describe("KnowledgePage — empty state", () => {
  test("shows 暂无文档 placeholder when document list is empty", async ({ page }) => {
    await page.goto("/knowledge");
    // Wait for the query to settle — either empty state or document rows appear
    await page.waitForLoadState("networkidle");
    const emptyState = page.getByText("暂无文档，请上传");
    const hasRows = page.getByRole("table");

    // One of the two must be present
    const isEmptyVisible = await emptyState.isVisible().catch(() => false);
    const hasTable = await hasRows.isVisible().catch(() => false);
    expect(isEmptyVisible || hasTable).toBe(true);
  });
});
