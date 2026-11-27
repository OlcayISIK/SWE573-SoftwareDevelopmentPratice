import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, signIn, uniqueEmail } from "./support";

test("a user proposes a practice status and an admin approves it", async ({ browser }) => {
  const author = uniqueEmail("author");
  const proposer = uniqueEmail("proposer");
  const craftName = `Shirvan kilim ${Date.now()}`;
  const source = "UNESCO List of Intangible Cultural Heritage, https://ich.unesco.org/en/lists";
  createUser(author, { name: "Craft Author" });
  createUser(proposer, { name: "Careful Reader" });
  const craftId = await apiCreateCraft(author, craftName);

  const proposerPage = await (await browser.newContext()).newPage();
  await signIn(proposerPage, proposer);
  await proposerPage.goto(`/crafts/${craftId}`);
  await proposerPage.getByRole("button", { name: "Propose a status" }).click();
  const dialog = proposerPage.getByRole("dialog", { name: "Propose a practice status" });
  await dialog.getByRole("radio", { name: /Endangered/ }).check();
  await dialog.getByLabel("Source").fill(source);
  await dialog.getByLabel("Note (optional)").fill("Only a few workshops still weave it.");
  await dialog.getByRole("button", { name: "Send proposal" }).click();
  await expect(dialog.getByRole("status")).toContainText("An admin will check the source");

  const adminPage = await (await browser.newContext()).newPage();
  await signIn(adminPage, "admin@e2e.example.com");
  await adminPage.goto("/admin/status-proposals");
  await adminPage.getByRole("link", { name: craftName }).click();
  await expect(adminPage.getByText("Only a few workshops still weave it.")).toBeVisible();
  await adminPage.getByRole("radio", { name: /Approve/ }).check();
  await adminPage.getByLabel("Reason").fill("The UNESCO list names this craft.");
  await adminPage.getByRole("button", { name: "Submit review" }).click();
  await expect(adminPage.getByRole("heading", { name: "Decision" })).toBeVisible();

  // Everyone sees the status and its source now.
  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(`/crafts/${craftId}`);
  const panel = guestPage.getByRole("region", { name: "Is it still practiced?" });
  await expect(panel).toContainText("Endangered");
  await expect(panel.getByRole("link", { name: "https://ich.unesco.org/en/lists" })).toBeVisible();

  await proposerPage.goto("/me/notifications");
  await expect(
    proposerPage.getByText(/was approved, so it is now marked as endangered/),
  ).toBeVisible();
});
