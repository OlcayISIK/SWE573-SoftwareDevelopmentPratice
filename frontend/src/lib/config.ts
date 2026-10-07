export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};
