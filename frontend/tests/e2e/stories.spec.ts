import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, signIn, uniqueEmail } from "./support";

test("a user shares a story, readers open it, and the craft's author is notified", async ({
  browser,
}) => {
  const author = uniqueEmail("story-author");
  const writer = uniqueEmail("story-writer");
  const craftName = `Uşak Halısı ${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  createUser(writer, { name: "Story Writer" });
  const craftId = await apiCreateCraft(author, craftName, {
    story: "Each medallion was knotted as a wish for the household.",
  });

  const writerPage = await (await browser.newContext()).newPage();
  await signIn(writerPage, writer);
  await writerPage.goto(`/crafts/${craftId}`);
  await writerPage.getByRole("button", { name: "Share your story" }).click();
  await writerPage
    .getByLabel("Your story")
    .fill("My grandmother knotted these in Uşak; the red came from madder root.");
  await writerPage.getByRole("button", { name: "Share story" }).click();
  await expect(writerPage.getByRole("button", { name: /Story Writer.*Your story/ })).toBeVisible();
  await expect(writerPage.getByRole("button", { name: "Share your story" })).toBeHidden();

  // A guest sees the author's story open first and the new story closed under its writer's name.
  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(`/crafts/${craftId}`);
  await expect(guestPage.getByRole("heading", { name: "Stories (2)" })).toBeVisible();
  const authorStory = guestPage.getByRole("button", { name: /Craft Author.*Craft author/ });
  await expect(authorStory).toHaveAttribute("aria-expanded", "true");
  const story = guestPage.getByRole("button", { name: /Story Writer/ });
  await expect(story).toHaveAttribute("aria-expanded", "false");
  await story.click();
  await expect(story).toHaveAttribute("aria-expanded", "true");
  await expect(guestPage.getByText(/the red came from madder root/)).toBeVisible();
  await expect(guestPage.getByRole("link", { name: "Log in to share your story" })).toBeVisible();

  const authorPage = await (await browser.newContext()).newPage();
  await signIn(authorPage, author);
  await authorPage.goto("/me/notifications");
  await expect(
    authorPage.getByText(`Story Writer shared a story about ${craftName}.`),
  ).toBeVisible();
});
