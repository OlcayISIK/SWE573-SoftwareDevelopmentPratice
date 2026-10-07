import axe from "axe-core";

export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, {
    // jsdom cannot compute colors or layout, so these rules are checked in the browser instead.
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help}`);
  expect(summary).toEqual([]);
}
