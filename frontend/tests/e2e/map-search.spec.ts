import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, place, uniqueEmail } from "./support";

test("a search shows every found craft on the map, even far apart", async ({ page }) => {
  const author = uniqueEmail("author");
  const word = `Faraway${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  // Too far apart to be drawn as one cluster when the whole world is shown.
  await apiCreateCraft(author, `${word} Uşak`, {
    places: [place("Uşak, Türkiye", 38.674, 29.406)],
  });
  await apiCreateCraft(author, `${word} Kochkor`, {
    places: [place("Kochkor, Kyrgyzstan", 42.209, 75.63)],
  });

  await page.goto(`/?search=${word}`);

  await expect(page.getByText("2 crafts")).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
});

test("a craft made in several places has a pin in each", async ({ page }) => {
  const author = uniqueEmail("author");
  const word = `Twoplaces${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  await apiCreateCraft(author, `${word} kilim`, {
    places: [
      place("Uşak, Türkiye", 38.674, 29.406),
      place("Teotitlán del Valle, Mexico", 17.03, -96.52, true),
    ],
  });

  await page.goto(`/?search=${word}`);

  await expect(page.getByText("1 craft", { exact: true })).toBeVisible();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
});
