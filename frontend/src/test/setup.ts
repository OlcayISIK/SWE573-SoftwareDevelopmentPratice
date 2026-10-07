import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";

import { session } from "@/api/session";
import { toast } from "@/lib/toast";

import { server } from "./server";

vi.mock("@/features/crafts/components/map/MapView", () => import("./mocks/MapView"));
vi.mock("@/features/crafts/components/map/LocationMap", () => import("./mocks/LocationMap"));

// jsdom does not implement scrolling; Leaflet calls it when focusing markers.
window.scrollTo = () => undefined;

// React Router builds requests with jsdom's AbortSignal, which Node's Request rejects.
// Navigation aborts do not matter in tests, so the signal is dropped.
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal: _signal, ...rest } = init ?? {};
    super(input, rest);
  }
} as typeof Request;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  session.clear();
  toast.clear();
  localStorage.clear();
});
afterAll(() => server.close());
