import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { toast } from "@/lib/toast";
import { craftsApi, mediaBody } from "@/features/crafts/api";
import { emptyCraftForm } from "@/features/crafts/form/schema";
import { loadDraft } from "@/features/crafts/form/useDraft";
import type { CraftType } from "@/features/crafts/types";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { craftTypes, kutahya } from "@/test/handlers";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function png(name = "tile.png") {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

function toastMessages() {
  return toast.getSnapshot().map((item) => item.message);
}

/** Opens a list such as Category and picks an option by its name. */
async function choose(label: string, option: string) {
  await userEvent.click(await screen.findByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

async function chooseCraftType(category = "Ceramics", craftType = "Tile") {
  await choose("Category", category);
  await choose("Craft type", craftType);
}

/** The form is ready once the categories are loaded. */
async function formReady() {
  await userEvent.click(await screen.findByRole("combobox", { name: "Category" }));
  await screen.findByRole("option", { name: "Ceramics" });
  await userEvent.keyboard("{Escape}");
}

async function pinAddress(address = "Ulu Cami, Kütahya") {
  await userEvent.type(screen.getByLabelText("Address"), address);
  await userEvent.click(screen.getByRole("button", { name: "Pin address" }));
}

async function fillRequiredFields() {
  await formReady();
  await userEvent.type(screen.getByLabelText("Name"), "Kütahya Çinisi");
  await chooseCraftType();
  await choose("Culture", "Turkish (Anatolia, Türkiye)");
  await pinAddress();
  await screen.findByText("Pinned at 39.41992, 29.98574.");
  await userEvent.type(screen.getByLabelText("About this craft"), "Glazed tiles.");
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

// The full flow fills in most of the form, so it needs more than the default time.
test("publishing a craft with tools, materials, a dimension, a photo and a video", async () => {
  server.use(...signedIn());
  const { created, uploads } = publishHandlers();
  const { router } = renderRoute("/crafts/new");

  await fillRequiredFields();
  expect(screen.getByText("Map moved to 39.419923, 29.985743")).toBeInTheDocument();
  const tools = screen.getByRole("group", { name: "Tools (optional)" });
  await userEvent.click(within(tools).getByRole("checkbox", { name: "Kiln" }));
  await userEvent.type(within(tools).getByLabelText("Other tools"), "loom");
  await userEvent.click(within(tools).getByRole("button", { name: "Add Loom" }));
  expect(within(tools).getByRole("list", { name: "Chosen tools" })).toHaveTextContent(/Kiln.*Loom/);
  const materials = screen.getByRole("group", { name: "Materials (optional)" });
  await userEvent.click(within(materials).getByRole("checkbox", { name: "Clay" }));
  await userEvent.click(screen.getByRole("button", { name: "Add a dimension" }));
  const dimension = screen.getByRole("group", { name: "Dimension 1" });
  await userEvent.type(within(dimension).getByLabelText("Amount"), "20");
  await userEvent.click(screen.getByRole("button", { name: "Add a color" }));
  const firstColor = screen.getByRole("group", { name: "Color 1" });
  await userEvent.type(within(firstColor).getByLabelText("Color code"), "rgb(30, 64, 175)");
  await userEvent.click(screen.getByRole("button", { name: "Add a color" }));
  const secondColor = screen.getByRole("group", { name: "Color 2" });
  await userEvent.type(within(secondColor).getByLabelText("Color code"), "turquoise");
  await userEvent.type(screen.getByLabelText("Story (optional)"), "Made for mosques.");
  await userEvent.upload(screen.getByLabelText("Photo file"), png());
  await userEvent.type(screen.getByLabelText("Alt text"), "Blue tile");
  await userEvent.click(screen.getByRole("button", { name: "Add to craft" }));
  await userEvent.click(screen.getByRole("radio", { name: "Video link" }));
  await userEvent.type(screen.getByLabelText("Video URL"), "https://youtu.be/abc123");
  await userEvent.click(screen.getByRole("button", { name: "Add to craft" }));

  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/crafts/42"));
  expect(created[0]).toEqual({
    name: "Kütahya Çinisi",
    category: 1,
    craft_type: 21,
    culture: 51,
    tools: [32, 33],
    materials: [41],
    places: [
      {
        address: "Ulu Cami, Kütahya",
        city: "Kütahya",
        country: "Türkiye",
        latitude: 39.419923,
        longitude: 29.985743,
        is_origin: false,
      },
    ],
    description: "Glazed tiles.",
    story: "Made for mosques.",
    colors: ["#1e40af", "#40e0d0"],
    attributes: {
      dimensions: [{ type: "height", value: 20, unit: "cm" }],
    },
  });
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
  expect(toastMessages()).toContain("Your craft is published.");
  expect(localStorage.getItem("ic.craft-draft.v3")).toBeNull();
}, 15_000);

test("an address that cannot be found is reported and nothing is pinned", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");
  await formReady();

  await pinAddress("nowhere at all");

  await waitFor(() => expect(toastMessages()).toContain("Address not found."));
  expect(screen.getByText("No pin yet.")).toBeInTheDocument();
});

test("placing the pin on the map fills in the address", async () => {
  server.use(...signedIn());
  const reversed: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/geocode/reverse/`, ({ request }) => {
      reversed.push(new URL(request.url).searchParams);
      return ok({
        latitude: 39.4192,
        longitude: 29.9833,
        address: "Cumhuriyet Caddesi, Kütahya Merkez, Türkiye",
        city: "Kütahya Merkez",
        country: "Türkiye",
      });
    }),
  );
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("button", { name: "Pick Kütahya on the map" }));

  await waitFor(() =>
    expect(screen.getByLabelText("Address")).toHaveValue(
      "Cumhuriyet Caddesi, Kütahya Merkez, Türkiye",
    ),
  );
  // The pin stays where the user put it.
  expect(screen.getByText(/^Pinned at 39\.4192\d, 29\.9833\d\.$/)).toBeInTheDocument();
  expect([reversed[0].get("lat"), reversed[0].get("lng")]).toEqual(["39.4192345", "29.9833471"]);
});

test("changing the category clears the craft type and lists the types of the new one", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");
  await formReady();
  expect(screen.getByLabelText("Craft type")).toBeDisabled();

  await chooseCraftType("Ceramics", "Tile");
  await choose("Category", "Textiles");

  const craftType = screen.getByRole("combobox", { name: "Craft type" });
  expect(craftType).toHaveTextContent("Choose a craft type");
  await userEvent.click(craftType);
  expect(await screen.findByRole("option", { name: "Carpet" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Tile" })).not.toBeInTheDocument();
});

test("a new category is added with the icon the user picks", async () => {
  server.use(...signedIn());
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/categories/`, async ({ request }) => {
      const body = (await request.json()) as Record<string, string>;
      bodies.push(body);
      return ok({ id: 9, slug: "fish-skin", user_added: true, ...body }, { status: 201 });
    }),
  );
  renderRoute("/crafts/new");
  await formReady();

  await userEvent.click(screen.getByRole("button", { name: "Add a new category" }));
  const adding = screen.getByRole("group", { name: "Adding a category" });
  await userEvent.type(within(adding).getByLabelText("New category"), "Fish skin");
  const icons = within(adding).getByRole("group", { name: "Icon" });
  expect(within(icons).getByRole("radio", { name: "Sparkles" })).toBeChecked();
  await userEvent.click(within(icons).getByRole("radio", { name: "Fish" }));
  await userEvent.click(within(adding).getByRole("button", { name: "Add category" }));

  await waitFor(() =>
    expect(bodies).toEqual([{ name: "Fish skin", description: "", icon: "fish" }]),
  );
});

test("a missing craft type is added and chosen", async () => {
  server.use(...signedIn());
  const added: CraftType[] = [];
  server.use(
    http.get(`${API}/craft-types/`, ({ request }) => {
      const category = Number(new URL(request.url).searchParams.get("category"));
      return ok([...craftTypes, ...added].filter((item) => item.category === category));
    }),
    http.post(`${API}/craft-types/`, async ({ request }) => {
      const body = (await request.json()) as {
        name: string;
        category: number;
        description: string;
      };
      const item = { id: 99, ...body, user_added: true };
      added.push(item);
      return ok(item, { status: 201 });
    }),
  );
  renderRoute("/crafts/new");
  await formReady();
  await choose("Category", "Ceramics");

  await userEvent.click(screen.getByRole("button", { name: "Add a new craft type" }));
  await userEvent.type(screen.getByLabelText("New craft type"), "Lustreware");
  await userEvent.click(screen.getByRole("button", { name: "Add craft type" }));

  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Craft type" })).toHaveTextContent("Lustreware"),
  );
  expect(added[0]).toMatchObject({ name: "Lustreware", category: 1 });
});

test("a tool that is not listed is added as a new tool for the craft type", async () => {
  server.use(...signedIn());
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/tools/`, async ({ request }) => {
      bodies.push(await request.json());
      return ok(
        { id: 98, name: "Spinning wheel", typical: true, user_added: true },
        { status: 201 },
      );
    }),
  );
  renderRoute("/crafts/new");
  await formReady();
  await chooseCraftType();

  const tools = screen.getByRole("group", { name: "Tools (optional)" });
  await userEvent.type(within(tools).getByLabelText("Other tools"), "Spinning wheel");
  await userEvent.click(
    within(tools).getByRole("button", { name: "Add “Spinning wheel” as a new tool" }),
  );

  expect(
    await within(tools).findByRole("button", { name: "Remove Spinning wheel" }),
  ).toBeInTheDocument();
  expect(bodies).toEqual([{ name: "Spinning wheel", craft_type: 21, description: "" }]);
});

test("tools and materials have an add link like the other lists", async () => {
  server.use(...signedIn());
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/materials/`, async ({ request }) => {
      bodies.push(await request.json());
      return ok({ id: 97, name: "Kermes dye", typical: true, user_added: true }, { status: 201 });
    }),
  );
  renderRoute("/crafts/new");
  await formReady();
  await chooseCraftType();

  const tools = screen.getByRole("group", { name: "Tools (optional)" });
  expect(within(tools).getByRole("button", { name: "Add a new tool" })).toBeVisible();
  const materials = screen.getByRole("group", { name: "Materials (optional)" });
  await userEvent.click(within(materials).getByRole("button", { name: "Add a new material" }));
  await userEvent.type(within(materials).getByLabelText("New material"), "Kermes dye");
  await userEvent.type(
    within(materials).getByLabelText("Description (optional)"),
    "A red dye from kermes insects.",
  );
  await userEvent.click(within(materials).getByRole("button", { name: "Add material" }));

  // The new material is chosen for the craft at once.
  expect(
    await within(materials).findByRole("button", { name: "Remove Kermes dye" }),
  ).toBeInTheDocument();
  expect(bodies).toEqual([
    { name: "Kermes dye", craft_type: 21, description: "A red dye from kermes insects." },
  ]);
});

test("the lists show each option's description", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("combobox", { name: "Category" }));
  expect(await screen.findByRole("option", { name: "Ceramics" })).toHaveAccessibleDescription(
    "Objects shaped from clay and hardened by firing.",
  );
  // The keys move through the options, and Escape closes the list.
  await userEvent.keyboard("{ArrowDown}{Enter}");
  expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("Textiles");
  await choose("Craft type", "Carpet");

  // Other tools are suggested while typing, each with its description.
  const tools = screen.getByRole("group", { name: "Tools (optional)" });
  await userEvent.type(within(tools).getByLabelText("Other tools"), "ki");
  const kiln = await within(tools).findByRole("option", { name: "Kiln" });
  expect(kiln).toHaveAccessibleDescription("An oven that fires clay, glaze or glass.");
  await userEvent.click(kiln);
  expect(within(tools).getByRole("button", { name: "Remove Kiln" })).toBeInTheDocument();
});

test("list items show their description on hover and focus", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");
  await formReady();
  await chooseCraftType();

  // The chosen category and craft type are described under their lists.
  expect(screen.getByLabelText("Category")).toHaveAccessibleDescription(
    "Objects shaped from clay and hardened by firing.",
  );
  expect(screen.getByLabelText("Craft type")).toHaveAccessibleDescription(
    "A flat piece of fired clay, usually glazed and painted.",
  );
  const tools = screen.getByRole("group", { name: "Tools (optional)" });
  const kiln = within(tools).getByRole("checkbox", { name: "Kiln" });
  expect(kiln).toHaveAccessibleDescription("An oven that fires clay, glaze or glass.");

  // A chosen item keeps its description.
  await userEvent.click(kiln);
  expect(within(tools).getByRole("button", { name: "Remove Kiln" })).toHaveAccessibleDescription(
    "An oven that fires clay, glaze or glass.",
  );
});

test("the form validates required fields in the browser", async () => {
  server.use(...signedIn());
  const create = vi.fn();
  server.use(http.post(`${API}/crafts/`, () => (create(), ok({}))));
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("button", { name: "Publish craft" }));

  expect(await screen.findByText("Enter the name of the craft.")).toBeInTheDocument();
  expect(screen.getByText("Choose a category.")).toBeInTheDocument();
  expect(screen.getByText("Choose a craft type.")).toBeInTheDocument();
  expect(screen.getByText("Choose the culture the craft belongs to.")).toBeInTheDocument();
  expect(screen.getByText("Enter the address of this place.")).toBeInTheDocument();
  expect(
    screen.getByText("Pin the location: use Pin address or click the map."),
  ).toBeInTheDocument();
  expect(screen.getByText("Describe the craft.")).toBeInTheDocument();
  expect(screen.getByLabelText("Name")).toHaveFocus();
  expect(create).not.toHaveBeenCalled();
});

test("each dimension can be entered once", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("button", { name: "Add a dimension" }));
  await userEvent.click(screen.getByRole("button", { name: "Add a dimension" }));
  const second = screen.getByRole("group", { name: "Dimension 2" });
  expect(within(second).getByLabelText("Measure")).toHaveValue("width");
  await userEvent.selectOptions(within(second).getByLabelText("Measure"), "height");
  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  expect(await within(second).findByText("This dimension is already entered.")).toBeVisible();
  const first = screen.getByRole("group", { name: "Dimension 1" });
  expect(within(first).getByText("Enter the amount.")).toBeVisible();
});

test("a weight or volume row offers the units of its kind", async () => {
  server.use(...signedIn());
  renderRoute("/crafts/new");

  await userEvent.click(await screen.findByRole("button", { name: "Add a dimension" }));
  const row = screen.getByRole("group", { name: "Dimension 1" });
  const unit = within(row).getByLabelText("Unit");
  const units = () =>
    within(unit)
      .getAllByRole("option")
      .map((option) => option.textContent);
  expect(units()).toEqual(["mm", "cm", "m", "in", "ft"]);

  await userEvent.selectOptions(within(row).getByLabelText("Measure"), "weight");
  expect(unit).toHaveValue("g");
  expect(units()).toEqual(["g", "kg", "oz", "lb"]);
  await userEvent.selectOptions(unit, "lb");
  await userEvent.selectOptions(within(row).getByLabelText("Measure"), "volume");
  expect(unit).toHaveValue("ml");
  expect(within(unit).getByRole("option", { name: "fl oz" })).toBeInTheDocument();
});

describe("colors", () => {
  test("the picker, the code, and the opacity stay in step", async () => {
    server.use(...signedIn());
    renderRoute("/crafts/new");

    await userEvent.click(await screen.findByRole("button", { name: "Add a color" }));
    const row = screen.getByRole("group", { name: "Color 1" });
    const code = within(row).getByLabelText("Color code");
    const picker = within(row).getByLabelText("Picker");
    const opacity = within(row).getByLabelText(/Opacity/);
    expect(opacity).toBeDisabled();

    await userEvent.type(code, "hsl(0 100% 50%)");
    expect(picker).toHaveValue("#ff0000");
    expect(opacity).toHaveValue("100");

    fireEvent.change(opacity, { target: { value: "50" } });
    expect(code).toHaveValue("#ff000080");

    fireEvent.input(picker, { target: { value: "#00ff00" } });
    expect(code).toHaveValue("#00ff0080");
  });

  test("codes that are not colors, and the same color twice, are flagged", async () => {
    server.use(...signedIn());
    renderRoute("/crafts/new");

    await userEvent.click(await screen.findByRole("button", { name: "Add a color" }));
    await userEvent.click(screen.getByRole("button", { name: "Add a color" }));
    await userEvent.click(screen.getByRole("button", { name: "Add a color" }));
    const [first, second, third] = [1, 2, 3].map((n) =>
      screen.getByRole("group", { name: `Color ${n}` }),
    );
    await userEvent.type(within(first).getByLabelText("Color code"), "navy");
    await userEvent.type(within(second).getByLabelText("Color code"), "#000080cc");
    await userEvent.type(within(third).getByLabelText("Color code"), "bluish");
    await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

    expect(await within(second).findByText("This color is already listed.")).toBeVisible();
    expect(
      within(third).getByText("Use a hex code (#1e40af), rgb(), hsl(), or a color name."),
    ).toBeVisible();
  });

  test("up to 10 colors can be added", async () => {
    server.use(...signedIn());
    renderRoute("/crafts/new");

    const add = await screen.findByRole("button", { name: "Add a color" });
    for (let n = 0; n < 10; n += 1) await userEvent.click(add);

    expect(screen.getAllByRole("group", { name: /^Color \d+$/ })).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Add a color" })).not.toBeInTheDocument();
  });
});

test("server errors on dimensions appear with the dimensions", async () => {
  server.use(
    ...signedIn(),
    http.post(`${API}/crafts/`, () =>
      fail(400, "Validation failed.", {
        attributes: { dimensions: { 0: { value: ["Ensure this value is less than 100000."] } } },
      }),
    ),
  );
  renderRoute("/crafts/new");

  await fillRequiredFields();
  await userEvent.click(screen.getByRole("button", { name: "Add a dimension" }));
  await userEvent.type(screen.getByLabelText("Amount"), "1");
  await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

  expect(await screen.findByText("Ensure this value is less than 100000.")).toBeInTheDocument();
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
  expect(toastMessages().join(" ")).toContain("1 media item could not be uploaded");
});

test("a draft survives a reload and can be discarded", async () => {
  server.use(...signedIn());
  const first = renderRoute("/crafts/new");
  await userEvent.type(await screen.findByLabelText("Name"), "Half-written craft");
  await waitFor(() => expect(localStorage.getItem("ic.craft-draft.v3")).toContain("Half-written"));
  first.unmount();

  server.use(...signedIn());
  renderRoute("/crafts/new");

  expect(await screen.findByLabelText("Name")).toHaveValue("Half-written craft");
  const notice = screen.getByRole("status", { name: "" });
  expect(notice).toHaveTextContent("We restored your unsaved draft.");
  await userEvent.click(within(notice).getByRole("button", { name: "Start over" }));
  expect(screen.getByLabelText("Name")).toHaveValue("");
});

test("a draft saved before the story field existed still loads", async () => {
  const { story: _story, ...older } = { ...emptyCraftForm, name: "Saved earlier" };
  localStorage.setItem("ic.craft-draft.v3", JSON.stringify(older));

  // An empty story passes validation; a missing one would block publishing.
  expect(loadDraft()).toEqual({ ...emptyCraftForm, name: "Saved earlier" });
});

test("drafts from the old form are dropped", async () => {
  localStorage.setItem("ic.craft-draft", JSON.stringify({ name: "Old", region: "10" }));
  localStorage.setItem("ic.craft-draft.v2", JSON.stringify({ name: "Old", address: "Uşak" }));
  server.use(...signedIn());
  renderRoute("/crafts/new");

  expect(await screen.findByLabelText("Name")).toHaveValue("");
  expect(localStorage.getItem("ic.craft-draft")).toBeNull();
  expect(localStorage.getItem("ic.craft-draft.v2")).toBeNull();
});

describe("places", () => {
  const iznik = {
    latitude: 40.429,
    longitude: 29.721,
    address: "İznik, Bursa, Türkiye",
    city: "İznik",
    country: "Türkiye",
  };

  test("a craft made in several places names one as the origin", async () => {
    server.use(...signedIn());
    const { created } = publishHandlers();
    server.use(
      http.get(`${API}/geocode/search/`, ({ request }) =>
        new URL(request.url).searchParams.get("q")?.includes("İznik") ? ok(iznik) : ok(kutahya),
      ),
    );
    renderRoute("/crafts/new");
    await fillRequiredFields();

    // One place needs no origin choice.
    expect(screen.queryByRole("group", { name: "Origin" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add another place" }));
    const second = screen.getByRole("group", { name: "Place 2" });
    await userEvent.type(within(second).getByLabelText("Address"), "İznik");
    await userEvent.click(within(second).getByRole("button", { name: "Pin address" }));
    expect(await within(second).findByText("Pinned at 40.42900, 29.72100.")).toBeVisible();

    const origin = screen.getByRole("group", { name: "Origin" });
    expect(within(origin).getByRole("radio", { name: "All places are equal" })).toBeChecked();
    await userEvent.click(within(origin).getByRole("radio", { name: /Place 2 is the origin/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish craft" }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].places).toEqual([
      expect.objectContaining({ city: "Kütahya", is_origin: false }),
      expect.objectContaining({ city: "İznik", latitude: 40.429, is_origin: true }),
    ]);
  });

  test("removing the origin makes all places equal again", async () => {
    server.use(...signedIn());
    renderRoute("/crafts/new");
    await formReady();

    await userEvent.click(screen.getByRole("button", { name: "Add another place" }));
    await userEvent.click(screen.getByRole("button", { name: "Add another place" }));
    const origin = screen.getByRole("group", { name: "Origin" });
    await userEvent.click(within(origin).getByRole("radio", { name: /Place 3 is the origin/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remove place 1" }));
    // Place 3 is now place 2 and stays the origin.
    expect(within(origin).getByRole("radio", { name: /Place 2 is the origin/ })).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Remove place 2" }));
    expect(screen.queryByRole("group", { name: "Origin" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add another place" }));
    expect(
      within(screen.getByRole("group", { name: "Origin" })).getByRole("radio", {
        name: "All places are equal",
      }),
    ).toBeChecked();
  });
});

test("the new craft page has no accessibility violations", async () => {
  server.use(...signedIn());
  const { container } = renderRoute("/crafts/new");
  await formReady();

  await expectNoA11yViolations(container);
});

describe("editing", () => {
  const craft = makeCraftDetail({
    colors: ["#1e40af80"],
    attributes: {
      dimensions: [{ type: "height", value: 20, unit: "cm" }],
    },
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
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Craft type" })).toHaveTextContent("Tile"),
    );
    expect(screen.getByLabelText("Address")).toHaveValue("Cumhuriyet Caddesi, Kütahya");
    expect(screen.getByRole("button", { name: "Remove Kiln" })).toBeInTheDocument();
    expect(screen.getByLabelText("Color code")).toHaveValue("#1e40af80");
    expect(screen.getByLabelText("Amount")).toHaveValue("20");
    await userEvent.clear(name);
    await userEvent.type(name, "Kütahya Tiles");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/crafts/1"));
    expect(patches[0]).toMatchObject({
      name: "Kütahya Tiles",
      category: 1,
      craft_type: 21,
      culture: 51,
      tools: [32],
      materials: [41],
      colors: ["#1e40af80"],
      attributes: {
        dimensions: [{ type: "height", value: 20, unit: "cm" }],
      },
    });
  });

  test("a craft type or culture an admin hid stays chosen when editing", async () => {
    const hidden = makeCraftDetail({
      craft_type: { id: 77, name: "Old tile", description: "", user_added: true },
      culture: { id: 78, name: "Old culture", homeland: "", description: "", user_added: true },
    });
    server.use(
      ...signedIn(makeUser({ id: 7 })),
      http.get(`${API}/crafts/1/`, () => ok(hidden)),
    );
    renderRoute("/crafts/1/edit");

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Craft type" })).toHaveTextContent("Old tile"),
    );
    expect(screen.getByRole("combobox", { name: "Culture" })).toHaveTextContent("Old culture");
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
