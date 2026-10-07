import { HttpResponse } from "msw";

export const API = "/api/v1";

export function ok<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json({ success: true, data, message: "OK" }, init);
}

export function fail(status: number, message: string, errors: Record<string, unknown> = {}) {
  return HttpResponse.json({ success: false, data: null, message, errors }, { status });
}
