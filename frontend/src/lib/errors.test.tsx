import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError } from "@/api/envelope";
import { Toaster } from "@/components/Toaster";

import { notifyGlobalError } from "./errors";
import { toast } from "./toast";

test.each([
  [new ApiError(0, "offline"), "Could not reach the server"],
  [new ApiError(429, "throttled"), "Too many requests"],
  [new ApiError(503, "down"), "Something went wrong on our side"],
])("shows a toast for errors the user cannot fix (%s)", (error, text) => {
  notifyGlobalError(error);

  expect(toast.getSnapshot()[0].message).toContain(text);
});

test.each([400, 401, 403, 404])("leaves %i errors to the page", (status) => {
  notifyGlobalError(new ApiError(status, "handled locally"));

  expect(toast.getSnapshot()).toEqual([]);
});

test("toaster shows errors with a retry action", async () => {
  const retry = vi.fn();
  render(<Toaster />);

  notifyGlobalError(new ApiError(0, "offline"), retry);
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("the same message is not shown twice", () => {
  notifyGlobalError(new ApiError(0, "offline"));
  notifyGlobalError(new ApiError(0, "offline"));

  expect(toast.getSnapshot()).toHaveLength(1);
});
