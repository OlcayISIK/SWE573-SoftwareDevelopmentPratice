import L from "./leafletSetup";

export const pinIcon = L.divIcon({
  className: "",
  html: '<span class="block h-4 w-4 rounded-full border-2 border-white bg-brand-700 shadow"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
