import { formatDimensions, formatWeight } from "./attributes";
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

test("dimensions are listed in the order they were entered, each with its unit", () => {
  expect(
    formatDimensions([
      { type: "height", value: 25.5, unit: "cm" },
      { type: "length", value: 2, unit: "m" },
    ]),
  ).toBe("height 25.5 cm, length 2 m");
  expect(formatDimensions([])).toBeNull();
  expect(formatDimensions(undefined)).toBeNull();
});

test("weight switches to kilograms from 1000 g", () => {
  expect(formatWeight(850)).toBe("850 g");
  expect(formatWeight(2400)).toBe("2.4 kg");
  expect(formatWeight(undefined)).toBeNull();
});
