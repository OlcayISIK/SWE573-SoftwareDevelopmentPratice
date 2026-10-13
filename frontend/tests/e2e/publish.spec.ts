import { expect, test } from "@playwright/test";

import { PASSWORD, PNG_BYTES, uniqueEmail } from "./support";

test("a new user registers, is signed in, and publishes a craft", async ({ page }) => {
  const email = uniqueEmail("author");
  const craftName = `Kütahya Çinisi ${Date.now()}`;

  await page.goto("/register");
  await page.getByLabel("Display name (optional)").fill("E2E Author");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  // Docker Compose runs with AUTO_VERIFY_EMAIL, so the new account is verified and signed in.
  await expect(page.getByRole("link", { name: "E2E Author" })).toBeVisible();

  // The address lookup is answered here, so the test does not depend on OpenStreetMap.
  await page.route("**/api/v1/geocode/search/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        message: "OK",
        data: {
          latitude: 39.417151,
          longitude: 29.975734,
          address: "Ulu Camii, Cumhuriyet Caddesi, Kütahya Merkez, Türkiye",
          city: "Kütahya",
          country: "Türkiye",
        },
      },
    }),
  );

  await page.getByRole("link", { name: "Add a craft" }).click();
  await page.getByLabel("Name").fill(craftName);
  await page.getByLabel("Category").selectOption({ label: "Ceramics" });
  await page.getByLabel("Craft type").selectOption({ label: "Tile" });
  await page.getByLabel("Culture").selectOption({ label: "Turkish (Anatolia, Türkiye)" });
  await page.getByLabel("Address", { exact: true }).fill("Ulu Camii, Kütahya");
  await page.getByRole("button", { name: "Pin address" }).click();
  await expect(page.getByText(/^Pinned at 39\.41715, 29\.97573\.$/)).toBeVisible();
  const tools = page.getByRole("group", { name: "Tools (optional)" });
  await tools.getByRole("checkbox", { name: "Kiln" }).check();
  const materials = page.getByRole("group", { name: "Materials (optional)" });
  await materials.getByRole("checkbox", { name: "Cobalt oxide" }).check();
  await page
    .getByLabel("About this craft")
    .fill("Hand-painted glazed tiles, shaped, painted, glazed, and fired.");
  await page
    .getByLabel("Story (optional)")
    .fill("Kütahya tiles have lined mosques and fountains since the 1400s.");
  await page.getByRole("button", { name: "Add a dimension" }).click();
  await page.getByLabel("Size").fill("20");
  await page.getByRole("button", { name: "Add a color" }).click();
  const color = page.getByRole("group", { name: "Color 1" });
  await color.getByLabel("Color code").fill("rgb(30, 64, 175)");
  await page
    .getByLabel("Photo file")
    .setInputFiles({ name: "tile.png", mimeType: "image/png", buffer: PNG_BYTES });
  await page.getByLabel("Alt text").fill("Blue glazed tile");
  await page.getByRole("button", { name: "Add to craft" }).click();
  await page.getByRole("button", { name: "Publish craft" }).click();

  await expect(page.getByRole("heading", { level: 1, name: craftName })).toBeVisible();
  const photo = page.getByRole("img", { name: "Blue glazed tile" });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText("#1e40af")).toBeVisible();
  await expect(page.getByText("Ceramics · Tile")).toBeVisible();
  await expect(page.getByText(/Turkish · From Kütahya, Türkiye/)).toBeVisible();
  await expect(page.getByText("height 20 cm")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Story" })).toBeVisible();
  await expect(page.getByText(/lined mosques and fountains/)).toBeVisible();

  await page.goto(`/crafts?search=${encodeURIComponent(craftName)}`);
  await expect(page.getByRole("link", { name: craftName })).toBeVisible();

  await page.goto("/?view=list&category=ceramics");
  await expect(
    page.getByRole("region", { name: "Crafts as a list" }).getByRole("link", { name: craftName }),
  ).toBeVisible();
});
