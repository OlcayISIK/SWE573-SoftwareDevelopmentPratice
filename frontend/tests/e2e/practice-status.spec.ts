import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, signIn, uniqueEmail } from "./support";

test("the author's practice status is reported and an admin corrects it", async ({ browser }) => {
  const author = uniqueEmail("author");
  const reporter = uniqueEmail("reporter");
  const craftName = `Shirvan kilim ${Date.now()}`;
  const source = "UNESCO List of Intangible Cultural Heritage, https://ich.unesco.org/en/lists";
  createUser(author, { name: "Craft Author" });
  createUser(reporter, { name: "Careful Reader" });
  // The author chooses the status when publishing, without a review.
  const craftId = await apiCreateCraft(author, craftName, { practice_status: "living" });

  const reporterPage = await (await browser.newContext()).newPage();
  await signIn(reporterPage, reporter);
  await reporterPage.goto(`/crafts/${craftId}`);
  const panel = reporterPage.getByRole("region", { name: "Is it still practiced?" });
  await expect(panel).toContainText("Living");
  await panel.getByRole("button", { name: "Report this status" }).click();
  const dialog = reporterPage.getByRole("dialog", { name: "Report the practice status" });
  await dialog.getByRole("radio", { name: /Endangered/ }).check();
  await dialog.getByLabel("Source").fill(source);
  await dialog.getByLabel("Note").fill("Only a few workshops still weave it.");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toContainText("An admin will review your report");

  const adminPage = await (await browser.newContext()).newPage();
  await signIn(adminPage, "admin@e2e.example.com");
  await adminPage.goto("/admin/status-proposals");
  await adminPage.getByRole("link", { name: craftName }).click();
  await expect(adminPage.getByText("Only a few workshops still weave it.")).toBeVisible();
  await adminPage.getByRole("radio", { name: /Accept/ }).check();
  await adminPage.getByLabel("Reason").fill("The UNESCO list names this craft.");
  await adminPage.getByRole("button", { name: "Submit review" }).click();
  await expect(adminPage.getByRole("heading", { name: "Decision" })).toBeVisible();

  // Everyone sees the corrected status and its source now.
  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(`/crafts/${craftId}`);
  const guestPanel = guestPage.getByRole("region", { name: "Is it still practiced?" });
  await expect(guestPanel).toContainText("Endangered");
  await expect(
    guestPanel.getByRole("link", { name: "https://ich.unesco.org/en/lists" }),
  ).toBeVisible();

  await reporterPage.goto("/me/notifications");
  await expect(
    reporterPage.getByText(/was accepted, so it is now marked as endangered/),
  ).toBeVisible();
});
