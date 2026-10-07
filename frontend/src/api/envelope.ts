import { isAxiosError } from "axios";

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, unknown>;

  constructor(status: number, message: string, errors: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  get isNetworkError() {
    return this.status === 0;
  }

  /** Flattens nested errors (for example `changes.latitude`) into field name -> messages. */
  get fieldErrors(): FieldErrors {
    return flatten(this.errors);
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
  errors?: Record<string, unknown>;
}

function isEnvelope(body: unknown): body is Envelope<unknown> {
  return typeof body === "object" && body !== null && "success" in body && "data" in body;
}

export function unwrap<T>(body: unknown): T {
  return (isEnvelope(body) ? body.data : body) as T;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(0, "Could not reach the server. Check your connection and try again.");
    }
    const body = error.response.data as Partial<Envelope<unknown>> | undefined;
    return new ApiError(
      error.response.status,
      body?.message || "Something went wrong. Please try again.",
      body?.errors ?? {},
    );
  }
  return new ApiError(0, error instanceof Error ? error.message : "Unexpected error.");
}

function flatten(errors: Record<string, unknown>, prefix = ""): FieldErrors {
  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      result[field] = value as string[];
    } else if (typeof value === "string") {
      result[field] = [value];
    } else if (value && typeof value === "object") {
      Object.assign(result, flatten(value as Record<string, unknown>, field));
    }
  }
  return result;
}
