import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, uniqueEmail } from "./support";

test("a search shows every found craft on the map, even far apart", async ({ page }) => {
  const author = uniqueEmail("author");
  const word = `Faraway${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  // Too far apart to be drawn as one cluster when the whole world is shown.
  await apiCreateCraft(author, `${word} Uşak`, { latitude: 38.674, longitude: 29.406 });
  await apiCreateCraft(author, `${word} Kochkor`, { latitude: 42.209, longitude: 75.63 });

  await page.goto(`/?search=${word}`);

  await expect(page.getByText("2 crafts")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
});
