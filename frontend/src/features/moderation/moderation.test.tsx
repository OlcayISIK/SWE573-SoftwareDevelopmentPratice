import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import type { ItemReportReview, ReportReview } from "@/features/moderation/api";
import { toast } from "@/lib/toast";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const admin = makeUser({ id: 1, role: "admin", display_name: "Admin" });

function makeReport(overrides: Partial<ReportReview> = {}): ReportReview {
  return {
    id: 5,
    craft: {
      id: 1,
      name: "Kütahya Çinisi",
      status: "published",
      is_deleted: false,
      author: { id: 50, display_name: "Mehmet" },
    },
    reporter: { id: 7, display_name: "Ayşe" },
    reason: "inaccurate",
    note: "The region looks wrong.",
    status: "open",
    created_at: "2026-10-06T09:00:00Z",
    actions: [],
    ...overrides,
  } as ReportReview;
}

function serveCraft() {
  server.use(
    http.get(`${API}/crafts/1/`, () =>
      ok(makeCraftDetail({ author: { id: 50, display_name: "Mehmet" } })),
    ),
  );
}

describe("reporting", () => {
  test("a registered user reports a craft", async () => {
    serveCraft();
    const reports: unknown[] = [];
    server.use(
      ...signedIn(),
      http.post(`${API}/crafts/1/report/`, async ({ request }) => {
        reports.push(await request.json());
        return ok({ id: 9, status: "open" }, { status: 201 });
      }),
    );
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Report" }));
    const dialog = screen.getByRole("dialog", { name: "Report this craft" });
    expect(within(dialog).getByRole("radio", { name: /Inaccurate/ })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("radio", { name: /Disrespectful/ }));
    await userEvent.type(within(dialog).getByLabelText("Details (optional)"), "Stereotyped text.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "An admin will review this craft.",
    );
    expect(reports).toEqual([{ reason: "disrespectful", note: "Stereotyped text." }]);
  });

  test("a reason is required", async () => {
    serveCraft();
    server.use(...signedIn());
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Report" }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a reason.");
  });

  test("a second open report is explained", async () => {
    serveCraft();
    server.use(
      ...signedIn(),
      http.post(`${API}/crafts/1/report/`, () =>
        fail(409, "You have already reported this craft. It is under review."),
      ),
    );
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Report" }));
    await userEvent.click(screen.getByRole("radio", { name: /Inaccurate/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already reported");
  });

  test("authors cannot report their own craft", async () => {
    serveCraft();
    server.use(...signedIn(makeUser({ id: 50 })));
    renderRoute("/crafts/1");

    await screen.findByRole("link", { name: "Edit" });
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  test("guests are asked to log in to report", async () => {
    serveCraft();
    renderRoute("/crafts/1");

    expect(await screen.findByRole("link", { name: "Log in to report" })).toBeInTheDocument();
  });
});

describe("admin review", () => {
  test("regular users cannot open the review queue", async () => {
    server.use(...signedIn());
    renderRoute("/admin/reports");

    expect(await screen.findByRole("heading", { name: "Not authorized" })).toBeInTheDocument();
  });

  test("admins see open reports and can filter by status", async () => {
    const calls: string[] = [];
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/`, ({ request }) => {
        const status = new URL(request.url).searchParams.get("status") ?? "";
        calls.push(status);
        const items = status === "open" ? [makeReport()] : [];
        return ok({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });
      }),
    );
    renderRoute("/admin/reports");

    const row = (await screen.findByRole("link", { name: "Kütahya Çinisi" })).closest("tr")!;
    expect(within(row).getByText("Inaccurate")).toBeInTheDocument();
    expect(within(row).getByText("Ayşe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review reports" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Resolved" }));
    expect(await screen.findByText("No reports here.")).toBeInTheDocument();
    expect(calls).toEqual(["open", "resolved"]);
  });

  test("hiding a reported craft records the decision", async () => {
    const reviews: unknown[] = [];
    let current = makeReport();
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/5/`, () => ok(current)),
      http.post(`${API}/moderation/reports/5/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        current = makeReport({
          status: "resolved",
          actions: [
            {
              id: 1,
              action: "hide",
              reason: "Misattributed origin.",
              admin: { id: 1, display_name: "Admin" },
              created_at: "2026-10-07T10:00:00Z",
            },
          ] as ReportReview["actions"],
        });
        return ok(current);
      }),
    );
    renderRoute("/admin/reports/5");

    await userEvent.click(await screen.findByRole("radio", { name: "Hide the craft" }));
    await userEvent.type(screen.getByLabelText("Reason"), "Misattributed origin.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("heading", { name: "Review history" })).toBeInTheDocument();
    expect(screen.getByText("Hide the craft by Admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit review" })).not.toBeInTheDocument();
    expect(reviews).toEqual([{ action: "hide", reason: "Misattributed origin." }]);
    expect(toast.getSnapshot()[0].message).toBe("The report has been reviewed.");
  });

  test("editing sends only the changed fields", async () => {
    const reviews: unknown[] = [];
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/5/`, () => ok(makeReport())),
      http.get(`${API}/crafts/1/`, () => ok(makeCraftDetail())),
      http.post(`${API}/moderation/reports/5/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        return ok(makeReport({ status: "resolved" }));
      }),
    );
    renderRoute("/admin/reports/5");

    await userEvent.click(await screen.findByRole("radio", { name: "Edit the craft" }));
    const description = await screen.findByLabelText("Description");
    expect(description).toHaveValue("Hand-painted glazed tiles.");
    await userEvent.clear(description);
    await userEvent.type(description, "Corrected description.");
    await userEvent.type(screen.getByLabelText("Reason"), "Fixed facts.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(reviews).toHaveLength(1));
    expect(reviews[0]).toEqual({
      action: "edit",
      reason: "Fixed facts.",
      changes: { description: "Corrected description." },
    });
  });

  test("removing asks for confirmation first", async () => {
    const reviews: unknown[] = [];
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/5/`, () => ok(makeReport())),
      http.post(`${API}/moderation/reports/5/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        return ok(makeReport({ status: "resolved" }));
      }),
    );
    renderRoute("/admin/reports/5");

    await userEvent.click(await screen.findByRole("radio", { name: "Remove the craft" }));
    await userEvent.type(screen.getByLabelText("Reason"), "Not a craft.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(reviews).toEqual([]);

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Remove this craft?" })).getByRole("button", {
        name: "Remove craft",
      }),
    );
    await waitFor(() => expect(reviews).toEqual([{ action: "remove", reason: "Not a craft." }]));
  });

  test("an action and a reason are required", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/5/`, () => ok(makeReport())),
    );
    renderRoute("/admin/reports/5");

    await userEvent.click(await screen.findByRole("button", { name: "Submit review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an action.");

    await userEvent.click(screen.getByRole("radio", { name: "Dismiss the report" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Explain the reason");
  });

  test("the review page has no accessibility violations", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/reports/5/`, () => ok(makeReport())),
    );
    const { container } = renderRoute("/admin/reports/5");
    await screen.findByRole("button", { name: "Submit review" });

    await expectNoA11yViolations(container);
  });
});

function makeItemReport(overrides: Partial<ItemReportReview> = {}): ItemReportReview {
  return {
    id: 8,
    item_type: "tool",
    item_id: 98,
    item_name: "Rug",
    item: {
      id: 98,
      name: "Rug",
      is_hidden: false,
      added_by: { id: 50, display_name: "Mehmet" },
      crafts_count: 1,
    },
    reporter: { id: 7, display_name: "Ayşe" },
    reason: "duplicate",
    note: "Not a tool.",
    status: "open",
    created_at: "2026-10-06T09:00:00Z",
    actions: [],
    ...overrides,
  } as ItemReportReview;
}

function serveItemReport(report = makeItemReport()) {
  const reviews: unknown[] = [];
  server.use(
    ...signedIn(admin),
    http.get(`${API}/moderation/item-reports/8/`, () => ok(report)),
    http.post(`${API}/moderation/item-reports/8/actions/`, async ({ request }) => {
      reviews.push(await request.json());
      return ok(makeItemReport({ status: "resolved" }));
    }),
  );
  return reviews;
}

describe("item review", () => {
  test("admins see reported items with who added them and how many crafts use them", async () => {
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/item-reports/`, () =>
        ok({ items: [makeItemReport()], total: 1, page: 1, pageSize: 20, totalPages: 1 }),
      ),
    );
    renderRoute("/admin/item-reports");

    const row = (await screen.findByRole("link", { name: "Rug" })).closest("tr")!;
    expect(within(row).getByText("Tool")).toBeInTheDocument();
    expect(within(row).getByText("1 craft")).toBeInTheDocument();
    expect(within(row).getByText("Duplicate")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).getByRole("link", { name: "Reported items" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("renaming sends the new name", async () => {
    const reviews = serveItemReport();
    renderRoute("/admin/item-reports/8");

    expect(await screen.findByText("Mehmet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Rename the item" }));
    const name = screen.getByLabelText("New name");
    expect(name).toHaveValue("Rug");
    await userEvent.clear(name);
    await userEvent.type(name, "Rug hook");
    await userEvent.type(screen.getByLabelText("Reason"), "Typo.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(reviews).toEqual([{ action: "rename", reason: "Typo.", name: "Rug hook" }]),
    );
  });

  test("merging asks for confirmation and names the crafts that move", async () => {
    const reviews = serveItemReport();
    renderRoute("/admin/item-reports/8");

    await userEvent.click(await screen.findByRole("radio", { name: "Merge into another item" }));
    const target = screen.getByLabelText("Merge into");
    await userEvent.selectOptions(target, await screen.findByRole("option", { name: "Loom" }));
    expect(within(target).queryByRole("option", { name: "Rug" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Reason"), "Duplicate of Loom.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    const dialog = screen.getByRole("dialog", { name: "Merge “Rug” into “Loom”?" });
    expect(dialog).toHaveTextContent("The 1 craft that use “Rug” will use “Loom” instead");
    expect(reviews).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Merge" }));

    await waitFor(() =>
      expect(reviews).toEqual([{ action: "merge", reason: "Duplicate of Loom.", merge_into: 33 }]),
    );
  });

  test("craft types to merge into show their category", async () => {
    serveItemReport(
      makeItemReport({
        item_type: "craft_type",
        item_name: "Rag rug",
        item: { ...makeItemReport().item!, id: 99, name: "Rag rug" },
      }),
    );
    renderRoute("/admin/item-reports/8");

    await userEvent.click(await screen.findByRole("radio", { name: "Merge into another item" }));

    expect(await screen.findByRole("option", { name: "Carpet (Textiles)" })).toBeInTheDocument();
  });

  test("a report on an item that was merged away can only be dismissed", async () => {
    serveItemReport(makeItemReport({ item: null as never }));
    renderRoute("/admin/item-reports/8");

    expect(await screen.findByText("Merged away or deleted")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "dismiss",
    ]);
  });

  test("the review history shows what changed", async () => {
    serveItemReport(
      makeItemReport({
        status: "resolved",
        actions: [
          {
            id: 1,
            action: "rename",
            reason: "Typo.",
            details: { name: "Rug hook" },
            admin: { id: 1, display_name: "Admin" },
            created_at: "2026-10-07T09:00:00Z",
          },
        ],
      }),
    );
    renderRoute("/admin/item-reports/8");

    expect(await screen.findByText("Renamed to “Rug hook”.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("the item review page has no accessibility violations", async () => {
    serveItemReport();
    const { container } = renderRoute("/admin/item-reports/8");
    await screen.findByRole("button", { name: "Submit review" });

    await expectNoA11yViolations(container);
  });
});
