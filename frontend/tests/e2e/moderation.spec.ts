import { expect, test } from "@playwright/test";

import { apiCreateCraft, createUser, signIn, uniqueEmail } from "./support";

test("a reported craft is hidden by an admin and the reporter is notified", async ({ browser }) => {
  const author = uniqueEmail("author");
  const reporter = uniqueEmail("reporter");
  const craftName = `Uşak Halısı ${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  createUser(reporter, { name: "Careful Reader" });
  const craftId = await apiCreateCraft(author, craftName);

  const reporterPage = await (await browser.newContext()).newPage();
  await signIn(reporterPage, reporter);
  await reporterPage.goto(`/crafts/${craftId}`);
  await reporterPage.getByRole("button", { name: "Report" }).click();
  const dialog = reporterPage.getByRole("dialog", { name: "Report this craft" });
  await dialog.getByRole("radio", { name: /Disrespectful/ }).check();
  await dialog.getByLabel("Details (optional)").fill("The description stereotypes the weavers.");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toContainText("An admin will review this craft.");

  const adminPage = await (await browser.newContext()).newPage();
  await signIn(adminPage, "admin@e2e.example.com");
  await adminPage.goto("/admin/reports");
  await adminPage.getByRole("link", { name: craftName }).click();
  await expect(adminPage.getByText("The description stereotypes the weavers.")).toBeVisible();
  await adminPage.getByRole("radio", { name: "Hide the craft" }).check();
  await adminPage.getByLabel("Reason").fill("Stereotyping language.");
  await adminPage.getByRole("button", { name: "Submit review" }).click();
  await expect(adminPage.getByRole("heading", { name: "Review history" })).toBeVisible();

  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(`/crafts/${craftId}`);
  await expect(guestPage.getByRole("heading", { name: "Craft not found" })).toBeVisible();

  // The craft is hidden from the reporter now, so the notification no longer links to it.
  await reporterPage.goto("/me/notifications");
  await expect(
    reporterPage.getByText("Your report was reviewed: the craft was hidden."),
  ).toBeVisible();
});
