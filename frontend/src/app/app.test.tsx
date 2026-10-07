import { screen } from "@testing-library/react";

import { expectNoA11yViolations } from "@/test/axe";
import { renderRoute } from "@/test/render";

test("home page renders inside the main layout", async () => {
  renderRoute("/");

  expect(
    await screen.findByRole("heading", { name: "Explore indigenous crafts" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
    "href",
    "#main",
  );
});

test("unknown routes show the not found page", async () => {
  renderRoute("/does-not-exist");

  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to the map" })).toHaveAttribute("href", "/");
});

test("layout has no accessibility violations", async () => {
  const { container } = renderRoute("/");
  await screen.findByRole("heading", { name: "Explore indigenous crafts" });

  await expectNoA11yViolations(container);
});
