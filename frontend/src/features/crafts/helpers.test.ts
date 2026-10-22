import { formatAmount, formatDimensions } from "./attributes";
import { formatCraftDate } from "./craftDate";
import { toEmbedUrl } from "./media";

test.each([
  ["https://www.youtube.com/watch?v=abc123", "https://www.youtube-nocookie.com/embed/abc123"],
  ["https://youtu.be/abc123", "https://www.youtube-nocookie.com/embed/abc123"],
  ["https://m.youtube.com/shorts/x_Y-9", "https://www.youtube-nocookie.com/embed/x_Y-9"],
  ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ["https://example.com/video.mp4", null],
  ["not a url", null],
  ["https://www.youtube.com/", null],
])("embed url for %s", (link, expected) => {
  expect(toEmbedUrl(link)).toBe(expected);
});

test("sizes are listed in the order they were entered, each with its unit", () => {
  expect(
    formatDimensions([
      { type: "height", value: 25.5, unit: "cm" },
      { type: "weight", value: 2, unit: "kg" },
      { type: "circumference", value: 3, unit: "ft" },
    ]),
  ).toBe("height 25.5 cm, circumference 3 ft");
  expect(formatDimensions([{ type: "weight", value: 2, unit: "kg" }])).toBeNull();
  expect(formatDimensions(undefined)).toBeNull();
});

test("weight and volume are shown in the unit they were entered in", () => {
  const rows = [
    { type: "height", value: 20, unit: "cm" },
    { type: "weight", value: 2.5, unit: "lb" },
    { type: "volume", value: 16, unit: "fl oz" },
  ] as const;
  expect(formatAmount([...rows], "weight")).toBe("2.5 lb");
  expect(formatAmount([...rows], "volume")).toBe("16 fl oz");
  expect(formatAmount([rows[0]], "weight")).toBeNull();
});

test.each([
  [{ kind: "year", year: -500, day: null, circa: false }, "500 BC"],
  [{ kind: "year", year: 300, day: null, circa: true }, "c. AD 300"],
  [{ kind: "year", year: 1850, day: null, circa: false }, "1850"],
  [{ kind: "day", year: 1923, day: "1923-03-12", circa: false }, "12 March 1923"],
  [{ kind: "unknown", year: null, day: null, circa: false }, null],
] as const)("the date %o reads as %s", (date, expected) => {
  expect(formatCraftDate(date)).toBe(expected);
});
