import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
export const PASSWORD = "E2e-Str0ng-Passw0rd!";
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function compose(...args: string[]) {
  return execFileSync("docker", ["compose", ...args], { cwd: REPO_ROOT, encoding: "utf-8" });
}

/** Runs Python inside the backend container with Django set up. */
export function djangoShell(code: string) {
  return compose("exec", "-T", "backend", "python", "manage.py", "shell", "-c", code);
}

export function uniqueEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Creates a verified user directly, skipping registration rate limits. */
export function createUser(email: string, { admin = false, name = "E2E User" } = {}) {
  djangoShell(
    [
      "from accounts.models import User",
      `user = User.objects.create_${admin ? "superuser" : "user"}(email="${email}", password="${PASSWORD}", is_email_verified=True)`,
      `user.profile.display_name = "${name}"`,
      "user.profile.save()",
    ].join("; "),
  );
}

/** Finds the newest link of the given kind in emails printed by the backend's console backend. */
export function latestEmailLink(email: string, path: "verify-email" | "password-reset") {
  const logs = compose("logs", "--no-log-prefix", "backend");
  const start = logs.lastIndexOf(`To: ${email}`);
  if (start === -1) {
    throw new Error(`No email to ${email} in the backend logs.`);
  }
  const match = logs
    .slice(start)
    .match(new RegExp(`https?://\\S+/${path}\\?uid=[\\w-]+&token=[\\w-]+`));
  if (!match) {
    throw new Error(`No ${path} link in the email to ${email}.`);
  }
  return new URL(match[0]);
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { data: T; message: string };
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${payload.message}`);
  }
  return payload.data;
}

export function apiLogin(email: string) {
  return apiPost<{ access: string; refresh: string }>("/auth/token/", {
    email,
    password: PASSWORD,
  });
}

/** Publishes a craft through the API and returns its id. */
export async function apiCreateCraft(email: string, name: string) {
  const { access } = await apiLogin(email);
  const categories = (await (await fetch(`${API_URL}/categories/`)).json()).data as {
    id: number;
    slug: string;
  }[];
  const regions = (await (await fetch(`${API_URL}/regions/`)).json()).data as {
    id: number;
    name: string;
  }[];
  const craft = await apiPost<{ id: number }>(
    "/crafts/",
    {
      name,
      craft_type: "Carpet",
      category: categories.find((c) => c.slug === "textiles")!.id,
      region: regions.find((r) => r.name === "Uşak")!.id,
      latitude: 38.68,
      longitude: 29.41,
      description: "Hand-knotted wool carpet.",
      production_process: "Knotted by hand on a loom.",
      how_to_understand: "Medallion layouts are typical.",
      cultural_relevance: "Exported widely since the 16th century.",
    },
    access,
  );
  return craft.id;
}

/**
 * Signs the page in by handing the app a refresh token, as a reload after login would. The init
 * script runs on every navigation, so it must not overwrite the token the app has since rotated.
 */
export async function signIn(page: Page, email: string) {
  const { refresh } = await apiLogin(email);
  await page.addInitScript((token) => {
    if (!localStorage.getItem("ic.refresh")) localStorage.setItem("ic.refresh", token);
  }, refresh);
}

/** A tiny valid PNG, so uploads do not depend on files in the repository. */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGOUC1jAgA0wYRUdtBIA11oBHhjYBeIAAAAASUVORK5CYII=",
  "base64",
);
