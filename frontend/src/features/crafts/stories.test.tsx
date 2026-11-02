import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import type { CraftDetail, CraftStory } from "@/features/crafts/types";
import { toast } from "@/lib/toast";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const STORIES = `${API}/crafts/1/stories/`;

function makeStory(id: number, name: string, text: string): CraftStory {
  return {
    id,
    text,
    author: { id: 100 + id, display_name: name },
    created_at: `2026-10-${10 + id}T09:00:00Z`,
    updated_at: `2026-10-${10 + id}T09:00:00Z`,
  };
}

const mehmet = makeStory(1, "Mehmet Kaya", "My grandmother wove these in Konya every winter.");
const elif = makeStory(2, "Elif Demir", "We hung one over the door for luck.");

function page(items: CraftStory[], { page = 1, totalPages = 1, total = items.length } = {}) {
  return { items, total, page, pageSize: 10, totalPages };
}

/** Serves the craft and its stories; a request with ?author= gets that writer's story. */
function serve(craft: CraftDetail, stories: CraftStory[]) {
  server.use(
    http.get(`${API}/crafts/1/`, () => ok(craft)),
    http.get(STORIES, ({ request }) => {
      const author = new URL(request.url).searchParams.get("author");
      return ok(page(author ? stories.filter((s) => s.author.id === Number(author)) : stories));
    }),
  );
}

function header(name: RegExp | string) {
  return screen.getByRole("button", { name });
}

function toastMessages() {
  return toast.getSnapshot().map((item) => item.message);
}

const withAuthorStory = makeCraftDetail({
  story: "Kilims carry wishes for the household.",
  story_count: 2,
});

test("the author's story comes first and open, and other stories are closed", async () => {
  serve(withAuthorStory, [mehmet, elif]);
  renderRoute("/crafts/1");

  expect(await screen.findByRole("heading", { name: "Stories (3)" })).toBeVisible();
  const author = await screen.findByRole("button", { name: /Ayşe.*Craft author/ });
  expect(author).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Kilims carry wishes for the household.")).toBeVisible();

  const story = await screen.findByRole("button", { name: /Mehmet Kaya/ });
  expect(story).toHaveAttribute("aria-expanded", "false");
  // A closed header names the writer and the date, with a preview of the story.
  expect(story).toHaveTextContent("11 Oct 2026");
  expect(story).toHaveTextContent("My grandmother wove these in Konya every winter.");
  const panel = document.getElementById(story.getAttribute("aria-controls")!)!;
  expect(panel).not.toBeVisible();
});

test("opening a story shows all of it and a link to its writer", async () => {
  serve(withAuthorStory, [mehmet]);
  renderRoute("/crafts/1");

  const story = await screen.findByRole("button", { name: /Mehmet Kaya/ });
  await userEvent.click(story);

  expect(story).toHaveAttribute("aria-expanded", "true");
  const panel = document.getElementById(story.getAttribute("aria-controls")!)!;
  expect(panel).toBeVisible();
  expect(within(panel).getByText(mehmet.text)).toBeInTheDocument();
  expect(within(panel).getByRole("link", { name: "Mehmet Kaya" })).toHaveAttribute(
    "href",
    "/users/101",
  );
});

test("headers open and close with the keyboard", async () => {
  serve(withAuthorStory, [mehmet]);
  renderRoute("/crafts/1");

  const story = await screen.findByRole("button", { name: /Mehmet Kaya/ });
  story.focus();
  await userEvent.keyboard("{Enter}");
  expect(story).toHaveAttribute("aria-expanded", "true");
  await userEvent.keyboard(" ");
  expect(story).toHaveAttribute("aria-expanded", "false");
});

test("long stories show a short preview in the closed header", async () => {
  const long = makeStory(3, "Zeynep", `${"A long memory of the loom. ".repeat(20)}The end.`);
  serve(withAuthorStory, [long]);
  renderRoute("/crafts/1");

  const story = await screen.findByRole("button", { name: /Zeynep/ });
  expect(story).toHaveTextContent("…");
  expect(story).not.toHaveTextContent("The end.");
});

test("more than ten stories load with Show more stories", async () => {
  const first = Array.from({ length: 10 }, (_, i) => makeStory(i + 1, `Writer ${i + 1}`, "Story."));
  const last = makeStory(11, "Writer 11", "The last story.");
  server.use(
    http.get(`${API}/crafts/1/`, () => ok(makeCraftDetail({ story_count: 11 }))),
    http.get(STORIES, ({ request }) =>
      new URL(request.url).searchParams.get("page") === "2"
        ? ok(page([last], { page: 2, totalPages: 2, total: 11 }))
        : ok(page(first, { totalPages: 2, total: 11 })),
    ),
  );
  renderRoute("/crafts/1");

  expect(await screen.findByRole("button", { name: /Writer 10/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Writer 11/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Show more stories" }));

  expect(await screen.findByRole("button", { name: /Writer 11/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show more stories" })).not.toBeInTheDocument();
});

test("a craft without stories says so and invites guests to log in", async () => {
  serve(makeCraftDetail(), []);
  renderRoute("/crafts/1");

  expect(await screen.findByText("No stories yet.")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Stories" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in to share your story" })).toHaveAttribute(
    "href",
    "/login?next=%2Fcrafts%2F1",
  );
});

test("a signed-in user shares a story", async () => {
  const sent: unknown[] = [];
  const stories: CraftStory[] = [];
  server.use(...signedIn(makeUser({ id: 50, display_name: "Can" })));
  serve(makeCraftDetail(), stories);
  server.use(
    http.post(STORIES, async ({ request }) => {
      sent.push(await request.json());
      const story = {
        ...makeStory(5, "Can", "We make these in Avanos."),
        author: { id: 50, display_name: "Can" },
      };
      stories.push(story);
      return ok(story, { status: 201 });
    }),
  );
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: "Share your story" }));
  await userEvent.type(screen.getByLabelText("Your story"), "  We make these in Avanos.  ");
  expect(screen.getByText(/28 \/ 5000 characters/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Share story" }));

  await waitFor(() => expect(sent).toEqual([{ text: "We make these in Avanos." }]));
  expect(toastMessages()).toContain("Your story is shared.");
  expect(await screen.findByRole("button", { name: /Can.*Your story/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Share your story" })).not.toBeInTheDocument();
});

test("an empty story is not sent", async () => {
  const sent: unknown[] = [];
  server.use(...signedIn(makeUser({ id: 50 })));
  serve(makeCraftDetail(), []);
  server.use(http.post(STORIES, () => (sent.push(1), ok({}, { status: 201 }))));
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: "Share your story" }));
  await userEvent.type(screen.getByLabelText("Your story"), "   ");
  await userEvent.click(screen.getByRole("button", { name: "Share story" }));

  expect(screen.getByText("Write your story first.")).toBeInTheDocument();
  expect(screen.getByLabelText("Your story")).toHaveAttribute("aria-invalid", "true");
  expect(sent).toEqual([]);
});

test("a refused story shows the server's reason", async () => {
  server.use(...signedIn(makeUser({ id: 50 })));
  serve(makeCraftDetail(), []);
  server.use(
    http.post(STORIES, () =>
      fail(409, "You have already shared a story about this craft. Edit it instead."),
    ),
  );
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: "Share your story" }));
  await userEvent.type(screen.getByLabelText("Your story"), "Again.");
  await userEvent.click(screen.getByRole("button", { name: "Share story" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Edit it instead.");
});

test("the writer finds their own story first, and edits and deletes it", async () => {
  const mine = { ...elif, author: { id: 50, display_name: "Elif Demir" } };
  const patched: unknown[] = [];
  let deleted = false;
  server.use(...signedIn(makeUser({ id: 50, display_name: "Elif Demir" })));
  serve(withAuthorStory, [mehmet, mine]);
  server.use(
    http.patch(`${STORIES}${mine.id}/`, async ({ request }) => {
      patched.push(await request.json());
      return ok({ ...mine, text: "Told better." });
    }),
    http.delete(`${STORIES}${mine.id}/`, () => {
      deleted = true;
      return new Response(null, { status: 204 });
    }),
  );
  renderRoute("/crafts/1");

  const own = await screen.findByRole("button", { name: /Elif Demir.*Your story/ });
  const headers = screen.getAllByRole("button", { name: /Craft author|Your story|Mehmet Kaya/ });
  expect(headers.map((button) => button.textContent)).toEqual([
    expect.stringContaining("Craft author"),
    expect.stringContaining("Your story"),
    expect.stringContaining("Mehmet Kaya"),
  ]);
  expect(screen.queryByRole("button", { name: "Share your story" })).not.toBeInTheDocument();

  await userEvent.click(own);
  await userEvent.click(screen.getByRole("button", { name: "Edit story" }));
  const field = screen.getByLabelText("Your story");
  expect(field).toHaveValue(mine.text);
  await userEvent.clear(field);
  await userEvent.type(field, "Told better.");
  await userEvent.click(screen.getByRole("button", { name: "Save story" }));
  await waitFor(() => expect(patched).toEqual([{ text: "Told better." }]));
  expect(toastMessages()).toContain("Your story was updated.");

  await userEvent.click(await screen.findByRole("button", { name: "Delete story" }));
  const dialog = screen.getByRole("dialog", { name: "Delete this story?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete story" }));
  await waitFor(() => expect(deleted).toBe(true));
  expect(toastMessages()).toContain("The story was deleted.");
});

test("other users cannot edit or delete a story", async () => {
  server.use(...signedIn(makeUser({ id: 50 })));
  serve(withAuthorStory, [mehmet]);
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: /Mehmet Kaya/ }));
  expect(screen.queryByRole("button", { name: "Edit story" })).not.toBeInTheDocument();
});

test("the craft's author is not offered to share a story", async () => {
  server.use(...signedIn(makeUser({ id: 7 })));
  serve(withAuthorStory, [mehmet]);
  renderRoute("/crafts/1");

  expect(await screen.findByRole("button", { name: /Mehmet Kaya/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Share your story" })).not.toBeInTheDocument();
});

test("unverified users are asked to verify their email first", async () => {
  server.use(...signedIn(makeUser({ id: 50, is_email_verified: false })));
  serve(makeCraftDetail(), []);
  renderRoute("/crafts/1");

  expect(await screen.findByText(/Verify your email address to share your story/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Share your story" })).not.toBeInTheDocument();
});

test("the stories have no accessibility violations", async () => {
  serve(withAuthorStory, [mehmet, elif]);
  const { container } = renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: /Mehmet Kaya/ }));
  await expectNoA11yViolations(container);
});

test("stories that cannot be loaded say so", async () => {
  server.use(
    http.get(`${API}/crafts/1/`, () => ok(withAuthorStory)),
    http.get(STORIES, () => fail(500, "Internal server error.")),
  );
  renderRoute("/crafts/1");

  expect(await screen.findByText("Stories could not be loaded.")).toBeVisible();
  // The author's story still shows.
  expect(header(/Craft author/)).toBeInTheDocument();
});
