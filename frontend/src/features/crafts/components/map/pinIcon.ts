import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { categoryStyle } from "../../categoryStyle";

import L from "./leafletSetup";

const OCEAN = "#1d5c8a";

/** A teardrop pin in ocean blue with a white icon, as HTML for a Leaflet marker. */
function pinHtml(iconSvg: string) {
  return `<span class="craft-pin" style="display:block;width:34px;height:42px;position:relative">
    <svg viewBox="0 0 34 42" width="34" height="42" aria-hidden="true">
      <path d="M17 41C17 41 32 26.5 32 16A15 15 0 0 0 2 16C2 26.5 17 41 17 41Z" fill="${OCEAN}" stroke="#fff" stroke-width="2"/>
    </svg>
    <span style="position:absolute;left:9px;top:8px;width:16px;height:16px;color:#fff">${iconSvg}</span>
  </span>`;
}

function pin(html: string) {
  return L.divIcon({ className: "", html, iconSize: [34, 42], iconAnchor: [17, 41] });
}

/** The plain pin, used where there is no category, such as the craft form. */
export const pinIcon = pin(pinHtml(""));

const byIcon = new Map<string, L.DivIcon>();

/** The pin for a craft, with its category's icon inside. Built once per icon. */
export function pinIconFor(category: string, categoryIcon: string) {
  let icon = byIcon.get(categoryIcon);
  if (!icon) {
    const svg = renderToStaticMarkup(
      createElement(categoryStyle(category, categoryIcon).icon, { size: 16, strokeWidth: 2.25 }),
    );
    icon = pin(pinHtml(svg));
    byIcon.set(categoryIcon, icon);
  }
  return icon;
}

/** A cluster: a white circle with a sun-colored ring and the number of crafts. */
export function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
  return L.divIcon({
    className: "",
    html: `<span class="craft-cluster" style="width:${size}px;height:${size}px">${count}</span>`,
    iconSize: [size, size],
  });
}
