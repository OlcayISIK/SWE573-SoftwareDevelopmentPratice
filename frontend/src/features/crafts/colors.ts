/**
 * Reads colors typed in the usual CSS forms and turns them into the stored form: "#rrggbb", or
 * "#rrggbbaa" when the color is see-through.
 */

export interface ParsedColor {
  /** "#rrggbb", without transparency. */
  hex: string;
  /** From 0 (invisible) to 1 (solid). */
  alpha: number;
}

// The CSS named colors (CSS Color Module Level 4).
const NAMED: Record<string, string> = {
  aliceblue: "f0f8ff",
  antiquewhite: "faebd7",
  aqua: "00ffff",
  aquamarine: "7fffd4",
  azure: "f0ffff",
  beige: "f5f5dc",
  bisque: "ffe4c4",
  black: "000000",
  blanchedalmond: "ffebcd",
  blue: "0000ff",
  blueviolet: "8a2be2",
  brown: "a52a2a",
  burlywood: "deb887",
  cadetblue: "5f9ea0",
  chartreuse: "7fff00",
  chocolate: "d2691e",
  coral: "ff7f50",
  cornflowerblue: "6495ed",
  cornsilk: "fff8dc",
  crimson: "dc143c",
  cyan: "00ffff",
  darkblue: "00008b",
  darkcyan: "008b8b",
  darkgoldenrod: "b8860b",
  darkgray: "a9a9a9",
  darkgreen: "006400",
  darkgrey: "a9a9a9",
  darkkhaki: "bdb76b",
  darkmagenta: "8b008b",
  darkolivegreen: "556b2f",
  darkorange: "ff8c00",
  darkorchid: "9932cc",
  darkred: "8b0000",
  darksalmon: "e9967a",
  darkseagreen: "8fbc8f",
  darkslateblue: "483d8b",
  darkslategray: "2f4f4f",
  darkslategrey: "2f4f4f",
  darkturquoise: "00ced1",
  darkviolet: "9400d3",
  deeppink: "ff1493",
  deepskyblue: "00bfff",
  dimgray: "696969",
  dimgrey: "696969",
  dodgerblue: "1e90ff",
  firebrick: "b22222",
  floralwhite: "fffaf0",
  forestgreen: "228b22",
  fuchsia: "ff00ff",
  gainsboro: "dcdcdc",
  ghostwhite: "f8f8ff",
  gold: "ffd700",
  goldenrod: "daa520",
  gray: "808080",
  green: "008000",
  greenyellow: "adff2f",
  grey: "808080",
  honeydew: "f0fff0",
  hotpink: "ff69b4",
  indianred: "cd5c5c",
  indigo: "4b0082",
  ivory: "fffff0",
  khaki: "f0e68c",
  lavender: "e6e6fa",
  lavenderblush: "fff0f5",
  lawngreen: "7cfc00",
  lemonchiffon: "fffacd",
  lightblue: "add8e6",
  lightcoral: "f08080",
  lightcyan: "e0ffff",
  lightgoldenrodyellow: "fafad2",
  lightgray: "d3d3d3",
  lightgreen: "90ee90",
  lightgrey: "d3d3d3",
  lightpink: "ffb6c1",
  lightsalmon: "ffa07a",
  lightseagreen: "20b2aa",
  lightskyblue: "87cefa",
  lightslategray: "778899",
  lightslategrey: "778899",
  lightsteelblue: "b0c4de",
  lightyellow: "ffffe0",
  lime: "00ff00",
  limegreen: "32cd32",
  linen: "faf0e6",
  magenta: "ff00ff",
  maroon: "800000",
  mediumaquamarine: "66cdaa",
  mediumblue: "0000cd",
  mediumorchid: "ba55d3",
  mediumpurple: "9370db",
  mediumseagreen: "3cb371",
  mediumslateblue: "7b68ee",
  mediumspringgreen: "00fa9a",
  mediumturquoise: "48d1cc",
  mediumvioletred: "c71585",
  midnightblue: "191970",
  mintcream: "f5fffa",
  mistyrose: "ffe4e1",
  moccasin: "ffe4b5",
  navajowhite: "ffdead",
  navy: "000080",
  oldlace: "fdf5e6",
  olive: "808000",
  olivedrab: "6b8e23",
  orange: "ffa500",
  orangered: "ff4500",
  orchid: "da70d6",
  palegoldenrod: "eee8aa",
  palegreen: "98fb98",
  paleturquoise: "afeeee",
  palevioletred: "db7093",
  papayawhip: "ffefd5",
  peachpuff: "ffdab9",
  peru: "cd853f",
  pink: "ffc0cb",
  plum: "dda0dd",
  powderblue: "b0e0e6",
  purple: "800080",
  rebeccapurple: "663399",
  red: "ff0000",
  rosybrown: "bc8f8f",
  royalblue: "4169e1",
  saddlebrown: "8b4513",
  salmon: "fa8072",
  sandybrown: "f4a460",
  seagreen: "2e8b57",
  seashell: "fff5ee",
  sienna: "a0522d",
  silver: "c0c0c0",
  skyblue: "87ceeb",
  slateblue: "6a5acd",
  slategray: "708090",
  slategrey: "708090",
  snow: "fffafa",
  springgreen: "00ff7f",
  steelblue: "4682b4",
  tan: "d2b48c",
  teal: "008080",
  thistle: "d8bfd8",
  tomato: "ff6347",
  turquoise: "40e0d0",
  violet: "ee82ee",
  wheat: "f5deb3",
  white: "ffffff",
  whitesmoke: "f5f5f5",
  yellow: "ffff00",
  yellowgreen: "9acd32",
};

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const ARGS = String.raw`\(\s*(${NUMBER}%?|${NUMBER}(?:deg|turn)?)\s*[,\s]\s*(${NUMBER}%?)\s*[,\s]\s*(${NUMBER}%?)\s*(?:[,/]\s*(${NUMBER}%?)\s*)?\)`;
const RGB = new RegExp(`^rgba?${ARGS}$`, "i");
const HSL = new RegExp(`^hsla?${ARGS}$`, "i");
const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const byte = (value: number) =>
  Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");

function alphaOf(text: string | undefined) {
  if (text === undefined) return 1;
  const value = parseFloat(text);
  return clamp(text.endsWith("%") ? value / 100 : value, 0, 1);
}

function channel(text: string) {
  const value = parseFloat(text);
  return text.endsWith("%") ? (value / 100) * 255 : value;
}

function hue(text: string) {
  const value = parseFloat(text);
  const degrees = text.toLowerCase().endsWith("turn") ? value * 360 : value;
  return ((degrees % 360) + 360) % 360;
}

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const part = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return `#${byte(part(0))}${byte(part(8))}${byte(part(4))}`;
}

/** Reads a color, or returns null when the text is not a color. */
export function parseColor(input: string): ParsedColor | null {
  const text = input.trim().toLowerCase();

  if (NAMED[text]) return { hex: `#${NAMED[text]}`, alpha: 1 };

  const hex = HEX.exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
    return {
      hex: `#${digits.slice(0, 6)}`,
      alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1,
    };
  }

  const rgb = RGB.exec(text);
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(channel);
    return { hex: `#${byte(r)}${byte(g)}${byte(b)}`, alpha: alphaOf(rgb[4]) };
  }

  const hsl = HSL.exec(text);
  if (hsl && hsl[2].endsWith("%") && hsl[3].endsWith("%")) {
    const s = clamp(parseFloat(hsl[2]) / 100, 0, 1);
    const l = clamp(parseFloat(hsl[3]) / 100, 0, 1);
    return { hex: hslToHex(hue(hsl[1]), s, l), alpha: alphaOf(hsl[4]) };
  }

  return null;
}

/** The stored form: "#rrggbb", with an alpha byte only when the color is see-through. */
export function toStoredColor({ hex, alpha }: ParsedColor) {
  return alpha >= 1 ? hex : `${hex}${byte(alpha * 255)}`;
}
