import { expect, test } from "@playwright/test";

test("the production build serves the map with security headers and no console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

  const response = await page.goto("/");

  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await expect(page.getByRole("region", { name: "Map of crafts" })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(errors.filter((text) => text.includes("Content Security Policy"))).toEqual([]);
});

test("deep links load directly thanks to the index.html fallback", async ({ page }) => {
  await page.goto("/crafts?category=ceramics");

  await expect(page.getByRole("heading", { level: 1, name: "Crafts" })).toBeVisible();
  await expect(page.getByLabel("Category")).toHaveValue("ceramics");
});

test("unknown pages show the not found page", async ({ page }) => {
  await page.goto("/no/such/page");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
