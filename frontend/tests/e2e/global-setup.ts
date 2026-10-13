import { API_URL, djangoShell, removeTestData } from "./support";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

async function waitFor(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `${url} is not reachable. Start the stack from the repository root with: docker compose up -d --build`,
  );
}

export default async function globalSetup() {
  await waitFor(`${API_URL}/categories/`);
  await waitFor(BASE_URL);
  // Registration and login are rate-limited; start every run with fresh counters.
  djangoShell("from django.core.cache import cache; cache.clear()");
  // Also clears what a run that was stopped early left behind.
  removeTestData();
  djangoShell(
    [
      "from accounts.models import User",
      'User.objects.filter(email="admin@e2e.example.com").exists() or ' +
        'User.objects.create_superuser(email="admin@e2e.example.com", password="E2e-Str0ng-Passw0rd!")',
    ].join("; "),
  );
}
