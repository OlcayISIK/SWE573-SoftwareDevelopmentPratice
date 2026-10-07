import { act, screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";

import type { AppNotification } from "@/features/notifications/api";
import { expectNoA11yViolations } from "@/test/axe";
import { signedIn } from "@/test/fixtures";
import { API, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function makeNotification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 1,
    type: "new_craft_from_followed",
    is_read: false,
    actor: { id: 50, display_name: "Mehmet" },
    craft: { id: 3, name: "Uşak Halısı" },
    data: {},
    created_at: "2026-10-07T09:00:00Z",
    ...overrides,
  } as AppNotification;
}

function page(items: AppNotification[]) {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 };
}

test("guests do not see the bell", async () => {
  renderRoute("/");

  await screen.findByRole("link", { name: "Log in" });
  expect(screen.queryByRole("link", { name: /Notifications/ })).not.toBeInTheDocument();
});

test("the bell shows the unread count", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/unread-count/`, () => ok({ count: 3 })),
  );
  renderRoute("/");

  expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toHaveAttribute(
    "href",
    "/me/notifications",
  );
});

test("the unread count is refreshed every minute", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let count = 0;
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/unread-count/`, () => ok({ count: ++count })),
  );
  renderRoute("/");
  expect(await screen.findByRole("link", { name: "Notifications, 1 unread" })).toBeInTheDocument();

  await act(() => vi.advanceTimersByTimeAsync(60_000));

  expect(await screen.findByRole("link", { name: "Notifications, 2 unread" })).toBeInTheDocument();
  vi.useRealTimers();
});

test("each notification type reads naturally and links to visible crafts", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/`, () =>
      ok(
        page([
          makeNotification({ id: 1 }),
          makeNotification({ id: 2, type: "favorite_updated", craft: { id: 4, name: "Kilim" } }),
          makeNotification({
            id: 3,
            type: "report_resolved",
            actor: { id: 1, display_name: "Admin" },
            craft: { id: 5, name: "Barro negro" },
            data: { action: "hide", report_status: "resolved" },
          }),
          makeNotification({ id: 4, craft: null as never, is_read: true }),
        ]),
      ),
    ),
    http.post(`${API}/me/notifications/read/`, () => ok({ updated: 3 })),
  );
  renderRoute("/me/notifications");

  const list = await screen.findByRole("list");
  const items = within(list).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("New: Mehmet added Uşak Halısı.");
  expect(within(items[0]).getByRole("link", { name: "Uşak Halısı" })).toHaveAttribute(
    "href",
    "/crafts/3",
  );
  expect(items[1]).toHaveTextContent("Kilim, one of your favorites, was updated.");
  expect(items[2]).toHaveTextContent(
    "Your report on Barro negro was reviewed: the craft was hidden.",
  );
  expect(items[3]).toHaveTextContent("Mehmet added a craft that is no longer available.");
  expect(within(items[3]).queryByRole("link")).not.toBeInTheDocument();
});

test("opening the list marks notifications as read and clears the bell", async () => {
  const marked = vi.fn();
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/unread-count/`, () => ok({ count: 1 })),
    http.get(`${API}/me/notifications/`, () => ok(page([makeNotification({ id: 1 })]))),
    http.post(`${API}/me/notifications/read/`, async ({ request }) => {
      marked(await request.json());
      return ok({ updated: 1 });
    }),
  );
  renderRoute("/me/notifications");

  await waitFor(() => expect(marked).toHaveBeenCalledWith({}));
  expect(await screen.findByRole("link", { name: "Notifications" })).toBeInTheDocument();
});

test("an empty list explains how to get notifications", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/`, () => ok(page([]))),
  );
  renderRoute("/me/notifications");

  expect(await screen.findByText(/No notifications yet/)).toBeInTheDocument();
});

test("the notifications page has no accessibility violations", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/notifications/`, () => ok(page([makeNotification({ is_read: true })]))),
  );
  const { container } = renderRoute("/me/notifications");
  await screen.findByRole("list");

  await expectNoA11yViolations(container);
});
