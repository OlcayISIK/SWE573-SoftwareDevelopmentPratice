import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { toast } from "@/lib/toast";
import { craftsApi, mediaBody } from "@/features/crafts/api";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function png(name = "tile.png") {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

async function fillRequiredFields() {
  await screen.findByRole("option", { name: "Kütahya" });
  await userEvent.type(screen.getByLabelText("Name"), "Kütahya Çinisi");
  await userEvent.type(screen.getByLabelText("Type of craft"), "Tile");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "1");
  await userEvent.selectOptions(screen.getByLabelText("Region"), "10");
  await userEvent.click(await screen.findByRole("button", { name: "Pick Kütahya on the map" }));
  await userEvent.type(screen.getByLabelText("What it is"), "Glazed tiles.");
  await userEvent.type(screen.getByLabelText("How it is made"), "Painted and fired.");
  await userEvent.type(screen.getByLabelText("How to understand it"), "Floral motifs.");
  await userEvent.type(screen.getByLabelText("Cultural relevance"), "Anatolian tradition.");
}

function publishHandlers() {
  const created: Record<string, unknown>[] = [];
  const uploads = vi.spyOn(craftsApi, "addMedia");
  server.use(
    http.post(`${API}/crafts/`, async ({ request }) => {
      created.push((await request.json()) as Record<string, unknown>);
      return ok(makeCraftDetail({ id: 42 }), { status: 201 });
    }),
    http.post(`${API}/crafts/42/media/`, () => ok({ id: 1 }, { status: 201 })),
    http.get(`${API}/crafts/42/`, () => ok(makeCraftDetail({ id: 42 }))),
  );
  return { created, uploads };
}

test("guests are sent to log in first", async () => {
  const { router } = renderRoute("/crafts/new");

  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(router.state.location.search).toBe("?next=%2Fcrafts%2Fnew");
});

test("unverified users are asked to verify their email", async () => {
  server.use(...signedIn(makeUser({ is_email_verified: false })));
  renderRoute("/crafts/new");

  expect(
    await screen.findByRole("heading", { name: "Verify your email to publish" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send a new verification email" })).toBeVisible();
});

test("publishing a craft with a photo and a video", async () => {
  server.use(...signedIn());
  const { created, uploads } = publishHandlers();
  const { router } = renderRoute("/crafts/new");

  await fillRequiredFields();
  await userEvent.type(screen.getByLabelText("Height (cm)"), "20");
  await userEvent.type(screen.getByLabelText("Colors"), "cobalt blue, turquoise,");
  await userEvent.upload(screen.getByLabelText("Photo file"), png());
  await userEvent.type(screen.getByLabelText("Alt text"), "Blue tile");
  await userEvent.click(screen.getByRole("button", { name: "Add to craft" }));
  await userEvent.click(screen.getByRole("radio", { name: "Video link" }));
  await userEvent.type(screen.getByLabelText("Video URL"), "https://youtu.be/abc123");
  await userEvent.click(screen.getByRole("button", { name: "Add to craft" }));
  expect(screen.getByRole("button", { name: "Remove Photo: Blue tile" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Remove Video: https://youtu.be/abc123" }),
  ).toBeVisible();

  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/crafts/42"));
  expect(created[0]).toMatchObject({
    name: "Kütahya Çinisi",
    craft_type: "Tile",
    category: 1,
    region: 10,
    attributes: { dimensions_cm: { height: 20 }, colors: ["cobalt blue", "turquoise"] },
  });
  expect(created[0].latitude as number).toBeCloseTo(39.4192, 3);
  expect(uploads).toHaveBeenCalledTimes(2);
  expect(uploads.mock.calls[0].slice(0, 3)).toEqual([
    42,
    { media_type: "photo", file: expect.any(File), alt_text: "Blue tile", caption: "" },
    0,
  ]);
  expect(uploads.mock.calls[1].slice(0, 3)).toEqual([
    42,
    { media_type: "video", url: "https://youtu.be/abc123", caption: "" },
    1,
  ]);
  expect(toast.getSnapshot()[0].message).toBe("Your craft is published.");
  expect(localStorage.getItem("ic.craft-draft")).toBeNull();
});

test("the form validates required fields in the browser", async () => {
  server.use(...signedIn());
  const create = vi.fn();
  server.use(http.post(`${API}/crafts/`, () => (create(), ok({}))));
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("button", { name: "Publish craft" }));

  expect(await screen.findByText("Enter the name of the craft.")).toBeInTheDocument();
  expect(screen.getByText("Choose a category.")).toBeInTheDocument();
  expect(
    screen.getByText("Enter the latitude or pick the location on the map."),
  ).toBeInTheDocument();
  expect(screen.getByText("Explain its cultural relevance.")).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveFocus();
  expect(create).not.toHaveBeenCalled();
});

test("server errors on attributes appear next to the field", async () => {
  server.use(
    ...signedIn(),
    http.post(`${API}/crafts/`, () =>
      fail(400, "Validation failed.", {
        attributes: {
          dimensions_cm: { height: ["Ensure this value is greater than or equal to 0.01."] },
        },
      }),
    ),
  );
  renderRoute("/crafts/new");

  await fillRequiredFields();
  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  expect(
    await screen.findByText("Ensure this value is greater than or equal to 0.01."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Height (cm)")).toHaveAttribute("aria-invalid", "true");
});

test("photos need alt text and an allowed format", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");
  // File pickers do not reliably enforce `accept`, so the form must check the type itself.
  const user = userEvent.setup({ applyAccept: false });

  await user.upload(
    await screen.findByLabelText("Photo file"),
    new File(["GIF89a"], "anim.gif", { type: "image/gif" }),
  );
  await user.click(screen.getByRole("button", { name: "Add to craft" }));

  expect(await screen.findByText("Use a JPEG, PNG, or WebP image.")).toBeInTheDocument();
  expect(screen.getByText("Describe the photo for people who cannot see it.")).toBeInTheDocument();
});

test("failed uploads send the author to the edit page", async () => {
  server.use(...signedIn());
  publishHandlers();
  server.use(
    http.post(`${API}/crafts/42/media/`, () => fail(500, "Internal server error.")),
    http.get(`${API}/crafts/42/`, () =>
      ok(makeCraftDetail({ id: 42, author: { id: 7, display_name: "Ayşe" } })),
    ),
  );
  const { router } = renderRoute("/crafts/new");

  await fillRequiredFields();
  await userEvent.upload(screen.getByLabelText("Photo file"), png());
  await userEvent.type(screen.getByLabelText("Alt text"), "Blue tile");
  await userEvent.click(screen.getByRole("button", { name: "Add to craft" }));
  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/crafts/42/edit"));
  expect(
    toast
      .getSnapshot()
      .map((t) => t.message)
      .join(" "),
  ).toContain("1 media item could not be uploaded");
});

test("a draft survives a reload and can be discarded", async () => {
  server.use(...signedIn());
  const first = renderRoute("/crafts/new");
  await userEvent.type(await screen.findByLabelText("Name"), "Half-written craft");
  await waitFor(() => expect(localStorage.getItem("ic.craft-draft")).toContain("Half-written"));
  first.unmount();

  server.use(...signedIn());
  renderRoute("/crafts/new");

  expect(await screen.findByLabelText("Name")).toHaveValue("Half-written craft");
  const notice = screen.getByRole("status", { name: "" });
  expect(notice).toHaveTextContent("We restored your unsaved draft.");
  await userEvent.click(within(notice).getByRole("button", { name: "Start over" }));
  expect(screen.getByLabelText("Name")).toHaveValue("");
});

test("the new craft page has no accessibility violations", async () => {
  server.use(...signedIn());
  const { container } = renderRoute("/crafts/new");
  await screen.findByRole("option", { name: "Kütahya" });

  await expectNoA11yViolations(container);
});

describe("editing", () => {
  const craft = makeCraftDetail({
    attributes: { colors: ["cobalt blue"], dimensions_cm: { height: 20 } },
  });

  test("the author edits a craft", async () => {
    const patches: unknown[] = [];
    server.use(
      ...signedIn(makeUser({ id: 7 })),
      http.get(`${API}/crafts/1/`, () => ok(craft)),
      http.patch(`${API}/crafts/1/`, async ({ request }) => {
        patches.push(await request.json());
        return ok({ ...craft, name: "Kütahya Tiles" });
      }),
    );
    const { router } = renderRoute("/crafts/1/edit");

    const name = await screen.findByLabelText("Name");
    expect(name).toHaveValue("Kütahya Çinisi");
    expect(screen.getByLabelText("Colors")).toHaveValue("cobalt blue");
    expect(screen.getByLabelText("Height (cm)")).toHaveValue("20");
    await userEvent.clear(name);
    await userEvent.type(name, "Kütahya Tiles");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/crafts/1"));
    expect(patches[0]).toMatchObject({
      name: "Kütahya Tiles",
      category: 1,
      region: 10,
      attributes: { colors: ["cobalt blue"], dimensions_cm: { height: 20 } },
    });
  });

  test("other users cannot edit", async () => {
    server.use(
      ...signedIn(makeUser({ id: 99 })),
      http.get(`${API}/crafts/1/`, () => ok(craft)),
    );
    renderRoute("/crafts/1/edit");

    expect(await screen.findByRole("heading", { name: "Not authorized" })).toBeInTheDocument();
  });

  test("the author removes a media item after confirming", async () => {
    const removed = vi.fn();
    server.use(
      ...signedIn(makeUser({ id: 7 })),
      http.get(`${API}/crafts/1/`, () => ok(craft)),
      http.delete(`${API}/crafts/1/media/100/`, () => {
        removed();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderRoute("/crafts/1/edit");

    await userEvent.click(
      await screen.findByRole("button", { name: "Remove Photo: Blue tile with floral motifs" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }),
    );

    await waitFor(() => expect(removed).toHaveBeenCalledOnce());
  });

  test("admins can edit but not add media to someone else's craft", async () => {
    server.use(
      ...signedIn(makeUser({ id: 99, role: "admin" })),
      http.get(`${API}/crafts/1/`, () => ok(craft)),
    );
    renderRoute("/crafts/1/edit");

    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to craft" })).not.toBeInTheDocument();
  });
});

test("photos and documents are sent as multipart form data, videos as JSON", () => {
  const photo = png();
  const body = mediaBody(
    { media_type: "photo", file: photo, alt_text: "Blue tile", caption: "Front" },
    2,
  ) as FormData;

  expect(body).toBeInstanceOf(FormData);
  expect(body.get("file")).toBe(photo);
  expect(body.get("alt_text")).toBe("Blue tile");
  expect(body.get("order")).toBe("2");
  expect(mediaBody({ media_type: "video", url: "https://youtu.be/x", caption: "" }, 0)).toEqual({
    media_type: "video",
    url: "https://youtu.be/x",
    caption: "",
    order: 0,
  });
});
