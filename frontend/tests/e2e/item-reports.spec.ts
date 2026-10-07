import { expect, test } from "@playwright/test";

import { apiAddTool, apiCreateCraft, createUser, signIn, uniqueEmail } from "./support";

test("a tool a user added is reported and an admin merges it into the seeded one", async ({
  browser,
}) => {
  const author = uniqueEmail("author");
  const reporter = uniqueEmail("reporter");
  const toolName = `Weaving frame ${Date.now()}`;
  const craftName = `Kilim ${Date.now()}`;
  createUser(author, { name: "Craft Author" });
  createUser(reporter, { name: "Careful Reader" });
  const toolId = await apiAddTool(author, toolName);
  const craftId = await apiCreateCraft(author, craftName, { tools: [toolId] });

  const reporterPage = await (await browser.newContext()).newPage();
  await signIn(reporterPage, reporter);
  await reporterPage.goto(`/crafts/${craftId}`);
  await reporterPage.getByRole("button", { name: `Report tool ${toolName}` }).click();
  const dialog = reporterPage.getByRole("dialog", { name: `Report the tool “${toolName}”` });
  await dialog.getByRole("radio", { name: /Duplicate/ }).check();
  await dialog.getByLabel("Details (optional)").fill("This is a loom.");
  await dialog.getByRole("button", { name: "Send report" }).click();
  await expect(dialog.getByRole("status")).toContainText("An admin will review it.");

  const adminPage = await (await browser.newContext()).newPage();
  await signIn(adminPage, "admin@e2e.example.com");
  await adminPage.goto("/admin/item-reports");
  await adminPage.getByRole("link", { name: toolName }).click();
  await expect(adminPage.getByText("This is a loom.")).toBeVisible();
  await adminPage.getByRole("radio", { name: "Merge into another item" }).check();
  await adminPage.getByLabel("Merge into", { exact: true }).selectOption({ label: "Loom" });
  await adminPage.getByLabel("Reason").fill("Duplicate of Loom.");
  await adminPage.getByRole("button", { name: "Submit review" }).click();
  await adminPage.getByRole("dialog").getByRole("button", { name: "Merge" }).click();
  await expect(adminPage.getByText("Merged into “Loom”.")).toBeVisible();

  // The craft now uses the seeded tool.
  const guestPage = await (await browser.newContext()).newPage();
  await guestPage.goto(`/crafts/${craftId}`);
  const facts = guestPage.getByRole("complementary", { name: "Facts and location" });
  await expect(facts.getByText("Loom", { exact: true })).toBeVisible();
  await expect(facts.getByText(toolName)).toHaveCount(0);
});
