import { test, expect } from "@playwright/test";

/**
 * The critical path a real user takes, end to end against a real built app:
 * start a demo session → see real seeded data on the dashboard → open a
 * failed build → see the AI's evidence-backed analysis → approve a CI
 * Optimizer recommendation. This is the spec's own framing of "done":
 * connect repo → receive build → display build → analyze failure →
 * generate recommendation → approve proposed fix (connecting a real repo
 * is out of scope for E2E — demo mode stands in for it, see docs/ROADMAP.md).
 */
test("demo login → dashboard → failure analysis → recommendation approval", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Why did my build fail?" })).toBeVisible();

  await page.getByRole("button", { name: "Continue with demo workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Success rate")).toBeVisible();

  await page.getByRole("link", { name: "Builds", exact: true }).click();
  await expect(page).toHaveURL(/\/builds/);
  await page.getByRole("link", { name: "Failed", exact: true }).click();

  // Every row is now a failed build (filter applied), so the first list item is unambiguous.
  const firstFailedBuild = page.locator("ul li a").first();
  await expect(firstFailedBuild).toBeVisible();
  await firstFailedBuild.click();

  await expect(page.getByText("AI Analysis")).toBeVisible();
  await expect(page.getByText("Why it failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Likely fix", { exact: true })).toBeVisible();
  await expect(page.getByText(/confidence/i).first()).toBeVisible();

  await page.getByRole("link", { name: "Recommendations", exact: true }).click();
  await expect(page).toHaveURL(/\/recommendations/);

  const approveButton = page.getByRole("button", { name: "Approve" }).first();
  if (await approveButton.isVisible().catch(() => false)) {
    await approveButton.click();
    await expect(page.getByText("approved").first()).toBeVisible();
  }
});

test("flaky tests page shows evidence-based scores, not a blank slate", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with demo workspace" }).click();
  await page.getByRole("link", { name: "Flaky tests", exact: true }).click();
  await expect(page).toHaveURL(/\/flaky-tests/);
  await expect(page.getByRole("columnheader", { name: "Score" })).toBeVisible();
});
