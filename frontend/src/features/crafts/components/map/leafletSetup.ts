import L from "leaflet";

// leaflet.markercluster only ships a UMD build that extends the global `L`,
// so Leaflet must be global before that plugin is imported.
(globalThis as unknown as { L: typeof L }).L = L;

export default L;
