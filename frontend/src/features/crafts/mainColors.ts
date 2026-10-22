/** The main colors people filter by, in the order the backend matches them, with a swatch each. */
export const MAIN_COLORS = [
  { name: "red", label: "Red", swatch: "#c62828" },
  { name: "orange", label: "Orange", swatch: "#ef7d22" },
  { name: "yellow", label: "Yellow", swatch: "#f2c230" },
  { name: "green", label: "Green", swatch: "#3a8f3a" },
  { name: "turquoise", label: "Turquoise", swatch: "#1aa39a" },
  { name: "blue", label: "Blue", swatch: "#2563eb" },
  { name: "purple", label: "Purple", swatch: "#7e3fb5" },
  { name: "pink", label: "Pink", swatch: "#e86a9a" },
  { name: "brown", label: "Brown", swatch: "#7b4a26" },
  { name: "black", label: "Black", swatch: "#1c1c1c" },
  { name: "white", label: "White", swatch: "#ffffff" },
  { name: "grey", label: "Grey", swatch: "#9aa5b1" },
] as const;

export type MainColor = (typeof MAIN_COLORS)[number]["name"];

export function mainColorLabel(name: string) {
  return MAIN_COLORS.find((color) => color.name === name)?.label ?? name;
}
