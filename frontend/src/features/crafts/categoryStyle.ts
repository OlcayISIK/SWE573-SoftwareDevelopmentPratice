import {
  Amphora,
  Axe,
  Bird,
  Drum,
  Feather,
  Fish,
  Flame,
  Flower2,
  Footprints,
  Gem,
  GlassWater,
  Hammer,
  Leaf,
  type LucideIcon,
  Mountain,
  Paintbrush,
  Palette,
  Scissors,
  Shell,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Spool,
  Sun,
  Wheat,
} from "lucide-react";

import type { Category } from "./types";

export type CategoryIcon = Category["icon"];

/** Every icon a category can have, with a name for the icon picker. Matches the backend list. */
export const CATEGORY_ICONS: { key: CategoryIcon; icon: LucideIcon; label: string }[] = [
  { key: "spool", icon: Spool, label: "Spool" },
  { key: "amphora", icon: Amphora, label: "Pot" },
  { key: "glass-water", icon: GlassWater, label: "Glass" },
  { key: "feather", icon: Feather, label: "Feather" },
  { key: "mountain", icon: Mountain, label: "Stone" },
  { key: "shopping-basket", icon: ShoppingBasket, label: "Basket" },
  { key: "axe", icon: Axe, label: "Axe" },
  { key: "hammer", icon: Hammer, label: "Hammer" },
  { key: "gem", icon: Gem, label: "Gem" },
  { key: "footprints", icon: Footprints, label: "Footwear" },
  { key: "paintbrush", icon: Paintbrush, label: "Paintbrush" },
  { key: "drum", icon: Drum, label: "Drum" },
  { key: "scissors", icon: Scissors, label: "Scissors" },
  { key: "shirt", icon: Shirt, label: "Clothing" },
  { key: "leaf", icon: Leaf, label: "Leaf" },
  { key: "flower", icon: Flower2, label: "Flower" },
  { key: "shell", icon: Shell, label: "Shell" },
  { key: "fish", icon: Fish, label: "Fish" },
  { key: "bird", icon: Bird, label: "Bird" },
  { key: "sun", icon: Sun, label: "Sun" },
  { key: "flame", icon: Flame, label: "Flame" },
  { key: "palette", icon: Palette, label: "Palette" },
  { key: "wheat", icon: Wheat, label: "Wheat" },
  { key: "sparkles", icon: Sparkles, label: "Sparkles" },
];

export const DEFAULT_CATEGORY_ICON: CategoryIcon = "sparkles";

const ICONS = new Map(CATEGORY_ICONS.map((item) => [item.key as string, item.icon]));

/** Text colors with at least 4.5:1 contrast on white and on the page background. */
const COLORS: Record<string, string> = {
  textiles: "#1d5c8a",
  ceramics: "#17706f",
  glass: "#2b4a9a",
  "paper-and-calligraphy": "#33415c",
  "stone-carving": "#4f5b66",
  basketry: "#5e6b1f",
  woodwork: "#6b4a2b",
  metalwork: "#8a5a1e",
  jewelry: "#8c6410",
  leatherwork: "#8f3f21",
  lacquerware: "#9b2c2c",
  "musical-instruments": "#5b3f7a",
};

/** Categories users add get the ocean color. */
const OCEAN = "#1d5c8a";

/**
 * A category's icon and color, for chips, badges, card stripes, and map pins. The icon is the
 * one stored with the category; seeded categories also have their own color.
 */
export function categoryStyle(slug: string | undefined, icon?: string | null) {
  return {
    icon: ICONS.get(icon ?? "") ?? Sparkles,
    color: (slug && COLORS[slug]) || OCEAN,
  };
}
