import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import type { StoryReportReview } from "@/features/moderation/api";
import { toast } from "@/lib/toast";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const admin = makeUser({ id: 1, role: "admin", display_name: "Admin" });

const story = {
  id: 3,
  text: "This story is not about the craft at all.",
  author: { id: 60, display_name: "Mehmet Kaya" },
  created_at: "2026-10-20T09:00:00Z",
  updated_at: "2026-10-20T09:00:00Z",
};

function makeStoryReport(overrides: Partial<StoryReportReview> = {}): StoryReportReview {
  return {
    id: 8,
    story: {
      id: 3,
      text: story.text,
      status: "published",
      is_deleted: false,
      author: { id: 60, display_name: "Mehmet Kaya" },
      craft: { id: 1, name: "Kütahya Çinisi" },
    },
    reporter: { id: 7, display_name: "Ayşe" },
    reason: "inappropriate",
    note: "Off topic.",
    status: "open",
    created_at: "2026-10-21T09:00:00Z",
    actions: [],
    ...overrides,
  } as StoryReportReview;
}

function serveCraftWithStory() {
  server.use(
    http.get(`${API}/crafts/1/`, () => ok(makeCraftDetail({ story_count: 1 }))),
    http.get(`${API}/crafts/1/stories/`, ({ request }) => {
      const author = new URL(request.url).searchParams.get("author");
      const items = author && Number(author) !== story.author.id ? [] : [story];
      return ok({ items, total: items.length, page: 1, pageSize: 10, totalPages: 1 });
    }),
  );
}

function toastMessages() {
  return toast.getSnapshot().map((item) => item.message);
}

/** The only story is the first one, so it is open once it has loaded. */
async function storyLoaded() {
  const header = await screen.findByRole("button", { name: /^Mehmet Kaya/ });
  expect(header).toHaveAttribute("aria-expanded", "true");
}

describe("reporting a story", () => {
  test("a signed-in user reports a story", async () => {
    const reports: unknown[] = [];
    server.use(...signedIn(makeUser({ id: 50 })));
    serveCraftWithStory();
    server.use(
      http.post(`${API}/stories/3/report/`, async ({ request }) => {
        reports.push(await request.json());
        return ok({ id: 8, status: "open" }, { status: 201 });
      }),
    );
    renderRoute("/crafts/1");

    await storyLoaded();
    await userEvent.click(screen.getByRole("button", { name: "Report story by Mehmet Kaya" }));
    const dialog = screen.getByRole("dialog", { name: "Report this story" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Inappropriate/ }));
    await userEvent.type(within(dialog).getByLabelText("Details (optional)"), "Off topic.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "An admin will review this story.",
    );
    expect(reports).toEqual([{ reason: "inappropriate", note: "Off topic." }]);
  });

  test("writers, admins, and guests are not offered to report a story", async () => {
    serveCraftWithStory();
    const { unmount } = renderRoute("/crafts/1");
    await storyLoaded();
    expect(screen.queryByRole("button", { name: /Report story/ })).not.toBeInTheDocument();
    unmount();

    server.use(...signedIn(makeUser({ id: 60, display_name: "Mehmet Kaya" })));
    const writer = renderRoute("/crafts/1");
    // The writer's own story comes first and is already open.
    expect(await screen.findByRole("button", { name: "Edit story" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report story/ })).not.toBeInTheDocument();
    writer.unmount();

    server.use(...signedIn(admin));
    renderRoute("/crafts/1");
    await storyLoaded();
    expect(screen.queryByRole("button", { name: /Report story/ })).not.toBeInTheDocument();
  });
});

describe("reviewing story reports", () => {
  test("the queue lists reported stories with their craft and writer", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/`, () =>
        ok({ items: [makeStoryReport()], total: 1, page: 1, pageSize: 20, totalPages: 1 }),
      ),
    );
    renderRoute("/admin/story-reports");

    const row = (await screen.findByRole("link", { name: /This story is not about/ })).closest(
      "tr",
    )!;
    expect(row).toHaveTextContent("Kütahya Çinisi");
    expect(row).toHaveTextContent("Mehmet Kaya");
    expect(row).toHaveTextContent("Inappropriate");
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/admin/story-reports/8");
    expect(screen.getByRole("link", { name: "Reported stories" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("an admin hides a reported story with a reason", async () => {
    const reviews: unknown[] = [];
    let current = makeStoryReport();
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/8/`, () => ok(current)),
      http.post(`${API}/moderation/story-reports/8/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        current = makeStoryReport({
          status: "resolved",
          story: { ...makeStoryReport().story, status: "hidden" },
          actions: [
            {
              id: 1,
              action: "hide",
              reason: "Not about the craft.",
              admin: { id: 1, display_name: "Admin" },
              created_at: "2026-10-22T09:00:00Z",
            },
          ],
        });
        return ok(current);
      }),
    );
    renderRoute("/admin/story-reports/8");

    expect(await screen.findByText(story.text)).toBeVisible();
    expect(screen.getByText("Written by Mehmet Kaya")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kütahya Çinisi" })).toHaveAttribute(
      "href",
      "/crafts/1",
    );
    await userEvent.click(screen.getByRole("radio", { name: "Hide the story" }));
    await userEvent.type(screen.getByLabelText("Reason"), "Not about the craft.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(reviews).toEqual([{ action: "hide", reason: "Not about the craft." }]),
    );
    expect(toastMessages()).toContain("The report has been reviewed.");
    expect(await screen.findByRole("heading", { name: "Review history" })).toBeVisible();
    expect(screen.getByText("Hide the story by Admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("removing a story asks for confirmation first", async () => {
    const reviews: unknown[] = [];
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/8/`, () => ok(makeStoryReport())),
      http.post(`${API}/moderation/story-reports/8/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        return ok(makeStoryReport({ status: "resolved" }));
      }),
    );
    renderRoute("/admin/story-reports/8");

    await userEvent.click(await screen.findByRole("radio", { name: "Remove the story" }));
    await userEvent.type(screen.getByLabelText("Reason"), "Spam.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));
    const dialog = screen.getByRole("dialog", { name: "Remove this story?" });
    expect(reviews).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove story" }));

    await waitFor(() => expect(reviews).toEqual([{ action: "remove", reason: "Spam." }]));
  });

  test("a review needs an action and a reason", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/8/`, () => ok(makeStoryReport())),
    );
    renderRoute("/admin/story-reports/8");

    await userEvent.click(await screen.findByRole("button", { name: "Submit review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an action.");
    await userEvent.click(screen.getByRole("radio", { name: "Dismiss the report" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Explain the reason for this decision.");
  });

  test("a removed story still shows in its report", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/8/`, () =>
        ok(
          makeStoryReport({
            status: "resolved",
            story: { ...makeStoryReport().story, is_deleted: true },
          }),
        ),
      ),
    );
    renderRoute("/admin/story-reports/8");

    expect(await screen.findByText(story.text)).toBeVisible();
    expect(screen.getByText("Removed")).toBeInTheDocument();
  });

  test("an unknown report is not found", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/99/`, () => fail(404, "Report not found.")),
    );
    renderRoute("/admin/story-reports/99");

    expect(await screen.findByRole("heading", { name: "Report not found" })).toBeVisible();
  });

  test("the story review page has no accessibility violations", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/story-reports/8/`, () => ok(makeStoryReport())),
    );
    const { container } = renderRoute("/admin/story-reports/8");

    await screen.findByText(story.text);
    await expectNoA11yViolations(container);
  });
});
