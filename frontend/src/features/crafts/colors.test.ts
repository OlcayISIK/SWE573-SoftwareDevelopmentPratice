import { parseColor, toStoredColor } from "./colors";

const stored = (input: string) => {
  const parsed = parseColor(input);
  return parsed && toStoredColor(parsed);
};

test.each([
  ["#1e40af", "#1e40af"],
  ["#1E40AF", "#1e40af"],
  ["1e40af", "#1e40af"],
  ["#14a", "#1144aa"],
  ["#14a8", "#1144aa88"],
  ["#1e40af80", "#1e40af80"],
  ["#1e40afff", "#1e40af"],
  ["rgb(30, 64, 175)", "#1e40af"],
  ["rgb(30 64 175)", "#1e40af"],
  ["RGB(30,64,175)", "#1e40af"],
  ["rgba(30, 64, 175, 0.5)", "#1e40af80"],
  ["rgb(30 64 175 / 50%)", "#1e40af80"],
  ["rgb(100%, 0%, 0%)", "#ff0000"],
  ["rgb(300, -5, 0)", "#ff0000"],
  ["hsl(0, 100%, 50%)", "#ff0000"],
  ["hsl(120 100% 25%)", "#008000"],
  ["hsl(0.5turn 100% 50%)", "#00ffff"],
  ["hsla(240, 100%, 50%, 0.25)", "#0000ff40"],
  ["turquoise", "#40e0d0"],
  ["  Navy ", "#000080"],
  ["rebeccapurple", "#663399"],
])("%s is stored as %s", (input, expected) => {
  expect(stored(input)).toBe(expected);
});

test.each(["", "blue-ish", "#12", "#12345", "#1234567", "rgb(1, 2)", "hsl(0, 100, 50)", "red;"])(
  "%j is not a color",
  (input) => {
    expect(parseColor(input)).toBeNull();
  },
);

test("alpha is kept between 0 and 1", () => {
  expect(parseColor("rgba(0, 0, 0, 2)")?.alpha).toBe(1);
  expect(parseColor("#00000000")?.alpha).toBe(0);
});
