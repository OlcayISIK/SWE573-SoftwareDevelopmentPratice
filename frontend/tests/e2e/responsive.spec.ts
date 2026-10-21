import { expect, test } from "@playwright/test";

test("on mobile the filters open in a drawer and the map fills the screen", async ({ page }) => {
  await page.goto("/");

  const filtersButton = page.getByRole("button", { name: "Filters" });
  await expect(filtersButton).toBeVisible();
  // Categories are chips that scroll sideways; the other filters open in a panel.
  await expect(page.getByRole("radio", { name: "All categories" })).toBeChecked();
  await expect(page.getByLabel("Craft type")).toBeHidden();
  await filtersButton.click();
  await expect(page.getByLabel("Craft type")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator(".leaflet-container")).toBeVisible();
});
