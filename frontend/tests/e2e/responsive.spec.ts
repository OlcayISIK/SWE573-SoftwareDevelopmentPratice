import { expect, test } from "@playwright/test";

test("on mobile the filters open in a drawer and the map fills the screen", async ({ page }) => {
  await page.goto("/");

  const filtersButton = page.getByRole("button", { name: "Filters" });
  await expect(filtersButton).toBeVisible();
  await expect(page.getByLabel("Category")).toBeHidden();
  await filtersButton.click();
  await expect(page.getByLabel("Category")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator(".leaflet-container")).toBeVisible();
});
