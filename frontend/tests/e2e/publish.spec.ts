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

  await page.getByRole("link", { name: "Add a craft" }).click();
  await page.getByLabel("Name").fill(craftName);
  await page.getByLabel("Type of craft").fill("Tile");
  await page.getByLabel("Category").selectOption({ label: "Ceramics" });
  await page.getByLabel("Region").selectOption({ label: "Kütahya" });
  await page.getByLabel("Latitude").fill("39.4192");
  await page.getByLabel("Longitude").fill("29.9833");
  await page.getByLabel("What it is").fill("Hand-painted glazed tiles.");
  await page.getByLabel("How it is made").fill("Shaped, painted, glazed, and fired.");
  await page.getByLabel("How to understand it").fill("Floral motifs in cobalt blue.");
  await page.getByLabel("Cultural relevance").fill("A living Anatolian tradition.");
  await page.getByLabel("Colors").fill("cobalt blue, turquoise");
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
  await expect(page.getByText("cobalt blue, turquoise")).toBeVisible();

  await page.goto(`/crafts?search=${encodeURIComponent(craftName)}`);
  await expect(page.getByRole("link", { name: craftName })).toBeVisible();

  await page.goto("/?view=list&category=ceramics");
  await expect(
    page.getByRole("region", { name: "Crafts as a list" }).getByRole("link", { name: craftName }),
  ).toBeVisible();
});
