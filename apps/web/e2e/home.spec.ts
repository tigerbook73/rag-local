/**
 * @test-file   Home Page
 * @description e2e tests for home page redirect and nav link visibility
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY): Shengtian Liao @ [1]
 */
import { test, expect } from "@playwright/test";

test("redirects to /chat with no JS errors when home page is loaded", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await expect(page).toHaveURL(/\/chat/);
  expect(errors).toHaveLength(0);
});

test("shows all nav links as visible when navigating to home page", async ({ page }) => {
  await page.goto("/");
  for (const label of ["Chat", "Knowledge", "History", "Quality", "Settings"]) {
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
  }
});
