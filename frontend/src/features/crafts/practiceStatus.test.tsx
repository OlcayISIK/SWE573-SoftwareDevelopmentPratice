import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import type { StatusProposalReview } from "@/features/moderation/api";
import type { AppNotification } from "@/features/notifications/api";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeCraftListItem, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

import type { CraftDetail } from "./types";

const UNESCO = "UNESCO List of Intangible Cultural Heritage, https://ich.unesco.org/en/lists";
const admin = makeUser({ id: 1, role: "admin", display_name: "Admin" });

function serveCraft(craft: CraftDetail) {
  server.use(http.get(`${API}/crafts/${craft.id}/`, () => ok(craft)));
}

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 };
}

describe("on the craft page", () => {
  test("a known status shows a badge and its source, with links", async () => {
    serveCraft(makeCraftDetail({ practice_status: "endangered", practice_status_source: UNESCO }));
    const { container } = renderRoute("/crafts/1");

    const panel = await screen.findByRole("region", { name: "Is it still practiced?" });
    expect(screen.getAllByText("Practice status:")[0].parentElement).toHaveTextContent(
      "Practice status: Endangered",
    );
    expect(within(panel).getByText(/Practiced by few people/)).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "https://ich.unesco.org/en/lists" }),
    ).toHaveAttribute("href", "https://ich.unesco.org/en/lists");
    await expectNoA11yViolations(container);
  });

  test("an unknown status shows no badge, and guests are asked to log in to propose", async () => {
    serveCraft(makeCraftDetail());
    renderRoute("/crafts/1");

    const panel = await screen.findByRole("region", { name: "Is it still practiced?" });
    expect(within(panel).getByText(/Not known yet/)).toBeInTheDocument();
    expect(screen.queryByText("Practice status:")).toBeNull();
    expect(within(panel).getByRole("link", { name: "Log in to propose a status" })).toHaveAttribute(
      "href",
      "/login?next=%2Fcrafts%2F1",
    );
  });

  test("a signed-in user proposes a status with a source and a note", async () => {
    const bodies: unknown[] = [];
    server.use(
      ...signedIn(),
      http.post(`${API}/crafts/1/practice-status/proposals/`, async ({ request }) => {
        bodies.push(await request.json());
        return ok({ id: 4, craft: 1, status: "open" }, { status: 201 });
      }),
    );
    serveCraft(makeCraftDetail());
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Propose a status" }));
    const dialog = screen.getByRole("dialog", { name: "Propose a practice status" });
    // Unknown cannot be proposed.
    expect(within(dialog).queryByRole("radio", { name: /Unknown/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Send proposal" }));
    expect(within(dialog).getByText("Choose a status.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Source")).toHaveAccessibleDescription(
      /Give the source the practice status is based on/,
    );
    expect(bodies).toEqual([]);

    await userEvent.click(within(dialog).getByRole("radio", { name: /Endangered/ }));
    await userEvent.type(within(dialog).getByLabelText("Source"), UNESCO);
    await userEvent.type(within(dialog).getByLabelText("Note (optional)"), "Few workshops left.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send proposal" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent(/An admin will check/);
    expect(bodies).toEqual([
      { practice_status: "endangered", source: UNESCO, note: "Few workshops left." },
    ]);
  });

  test("a second open proposal is explained", async () => {
    server.use(
      ...signedIn(),
      http.post(`${API}/crafts/1/practice-status/proposals/`, () =>
        fail(
          409,
          "You have already proposed a practice status for this craft. It is under review.",
        ),
      ),
    );
    serveCraft(makeCraftDetail());
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Propose a status" }));
    const dialog = screen.getByRole("dialog", { name: "Propose a practice status" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Living/ }));
    await userEvent.type(within(dialog).getByLabelText("Source"), "Field visit");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send proposal" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /already proposed a practice status/,
    );
  });

  test("server errors are shown next to their fields", async () => {
    server.use(
      ...signedIn(),
      http.post(`${API}/crafts/1/practice-status/proposals/`, () =>
        fail(400, "Validation failed.", { source: ["Ensure this field has no more than 500."] }),
      ),
    );
    serveCraft(makeCraftDetail());
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Propose a status" }));
    const dialog = screen.getByRole("dialog", { name: "Propose a practice status" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Living/ }));
    await userEvent.type(within(dialog).getByLabelText("Source"), "x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send proposal" }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Source")).toHaveAccessibleDescription(
        /no more than 500/,
      ),
    );
  });

  test("admins set the status directly with a source and a reason", async () => {
    const bodies: unknown[] = [];
    let current = makeCraftDetail();
    const updated = makeCraftDetail({
      practice_status: "living",
      practice_status_source: "Field visit, 2025",
    });
    server.use(
      ...signedIn(admin),
      http.post(`${API}/crafts/1/practice-status/`, async ({ request }) => {
        bodies.push(await request.json());
        current = updated;
        return ok(updated);
      }),
      http.get(`${API}/crafts/1/`, () => ok(current)),
    );
    renderRoute("/crafts/1");

    await userEvent.click(await screen.findByRole("button", { name: "Set the status" }));
    const dialog = screen.getByRole("dialog", { name: "Set the practice status" });
    expect(within(dialog).getByRole("radio", { name: /Unknown/ })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("radio", { name: /Living/ }));
    await userEvent.type(within(dialog).getByLabelText("Source"), "Field visit, 2025");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save status" }));
    expect(within(dialog).getByLabelText("Reason")).toHaveAccessibleDescription(
      /Explain the reason/,
    );
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Checked.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save status" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bodies).toEqual([
      { practice_status: "living", source: "Field visit, 2025", reason: "Checked." },
    ]);
    const panel = screen.getByRole("region", { name: "Is it still practiced?" });
    expect(within(panel).getByText("Field visit, 2025")).toBeInTheDocument();
  });
});

describe("browsing", () => {
  test("cards show endangered and no longer practiced crafts", async () => {
    server.use(
      http.get(`${API}/crafts/`, () =>
        ok(
          page([
            makeCraftListItem({ id: 1, name: "Living one", practice_status: "living" }),
            makeCraftListItem({ id: 2, name: "At risk", practice_status: "endangered" }),
            makeCraftListItem({ id: 3, name: "Gone", practice_status: "no_longer_practiced" }),
          ]),
        ),
      ),
    );
    renderRoute("/crafts");

    const card = (name: string) =>
      screen.getByRole("link", { name }).closest("article") as HTMLElement;
    await screen.findByRole("link", { name: "At risk" });
    expect(within(card("At risk")).getByText("Endangered")).toBeInTheDocument();
    expect(within(card("Gone")).getByText("No longer practiced")).toBeInTheDocument();
    expect(within(card("Living one")).queryByText("Practice status:")).toBeNull();
  });

  test("the practice status filter has counts and is kept in the address bar", async () => {
    const calls: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/crafts/`, ({ request }) => {
        calls.push(new URL(request.url).searchParams);
        return ok(page([makeCraftListItem()]));
      }),
    );
    const { router } = renderRoute("/crafts");

    await userEvent.click(await screen.findByRole("button", { name: "Filters" }));
    await userEvent.selectOptions(
      screen.getByLabelText("Still practiced?"),
      await screen.findByRole("option", { name: "Endangered (1)" }),
    );

    await waitFor(() => expect(router.state.location.search).toBe("?practice_status=endangered"));
    await waitFor(() => expect(calls.at(-1)!.get("practice_status")).toBe("endangered"));
  });
});

function makeProposal(overrides: Partial<StatusProposalReview> = {}): StatusProposalReview {
  return {
    id: 4,
    craft: {
      id: 1,
      name: "Kütahya Çinisi",
      status: "published",
      is_deleted: false,
      practice_status: "unknown",
      practice_status_source: "",
    },
    proposer: { id: 7, display_name: "Ayşe" },
    practice_status: "endangered",
    source: UNESCO,
    note: "Few workshops left.",
    status: "open",
    created_at: "2026-12-02T09:00:00Z",
    reviewed_by: null,
    review_reason: "",
    reviewed_at: null,
    ...overrides,
  } as StatusProposalReview;
}

describe("the admin queue", () => {
  test("admins see proposals and approve one with a reason", async () => {
    const reviews: unknown[] = [];
    let proposal = makeProposal();
    server.use(
      ...signedIn(admin),
      http.get(`${API}/moderation/status-proposals/`, () => ok(page([proposal]))),
      http.get(`${API}/moderation/status-proposals/4/`, () => ok(proposal)),
      http.post(`${API}/moderation/status-proposals/4/actions/`, async ({ request }) => {
        reviews.push(await request.json());
        proposal = makeProposal({
          status: "approved",
          reviewed_by: { id: 1, display_name: "Admin" },
          review_reason: "On the list.",
          reviewed_at: "2026-12-02T10:00:00Z",
          craft: { ...proposal.craft, practice_status: "endangered" },
        });
        return ok(proposal);
      }),
    );
    const { container } = renderRoute("/admin/status-proposals");

    expect(await screen.findByRole("link", { name: "Status proposals" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const row = (await screen.findByRole("link", { name: "Kütahya Çinisi" })).closest("tr")!;
    expect(within(row).getByText("Endangered")).toBeInTheDocument();
    expect(within(row).getByText("Ayşe")).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await userEvent.click(within(row).getByRole("link", { name: "Kütahya Çinisi" }));
    expect(
      await screen.findByRole("link", { name: "https://ich.unesco.org/en/lists" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose approve or reject.");
    await userEvent.click(screen.getByRole("radio", { name: /Approve/ }));
    await userEvent.type(screen.getByLabelText("Reason"), "On the list.");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("heading", { name: "Decision" })).toBeInTheDocument();
    expect(screen.getByText("approved by Admin")).toBeInTheDocument();
    expect(reviews).toEqual([{ action: "approved", reason: "On the list." }]);
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
  });
});

describe("notifications", () => {
  function notification(overrides: Partial<AppNotification>) {
    return {
      id: 1,
      is_read: false,
      actor: { id: 1, display_name: "Admin" },
      craft: { id: 3, name: "Uşak Halısı" },
      created_at: "2026-12-02T09:00:00Z",
      ...overrides,
    } as AppNotification;
  }

  test("say when a favorite's status changed and when a proposal was reviewed", async () => {
    server.use(
      ...signedIn(),
      http.get(`${API}/me/notifications/`, () =>
        ok(
          page([
            notification({
              id: 1,
              type: "practice_status_changed",
              data: { old_status: "unknown", practice_status: "endangered" },
            }),
            notification({
              id: 2,
              type: "status_proposal_reviewed",
              data: { proposal_id: 4, decision: "approved", practice_status: "living" },
            }),
            notification({
              id: 3,
              type: "status_proposal_reviewed",
              data: { proposal_id: 5, decision: "rejected", practice_status: "endangered" },
            }),
          ]),
        ),
      ),
    );
    renderRoute("/me/notifications");

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            "New: Uşak Halısı, one of your favorites, is now marked as endangered.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            "New: Your proposal that Uşak Halısı is living was approved, so it is now marked as living.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "New: Your proposal that Uşak Halısı is endangered was rejected.",
      ),
    ).toBeInTheDocument();
  });
});
