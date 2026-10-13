# Indigenous Crafts Frontend

React single-page app for Indigenous Crafts, built with TypeScript and Vite.

## Run with Docker

From the repository root, `docker compose up --build` starts the database, the backend, and this app at http://localhost:5173. The backend loads 30 sample crafts with photos on startup, so the map is not empty.

## Run locally

Requires Node.js 22+ and the backend running at http://localhost:8000.

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

The Vite dev server proxies `/api` and `/media` to the backend, so no CORS setup is needed during development.

## Scripts

| Script                 | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the dev server                                   |
| `npm run build`        | Type check and build to `dist/`                        |
| `npm test`             | Run unit and component tests                           |
| `npm run lint`         | Lint with ESLint                                       |
| `npm run format`       | Format with Prettier                                   |
| `npm run generate:api` | Regenerate API types from the running backend's schema |
| `npm run test:e2e`     | Run the Playwright end-to-end tests                    |

## End-to-end tests

The Playwright tests run against the full Docker Compose stack, including the production Nginx build.

```
# from the repository root
docker compose up -d --build

# from frontend/
npx playwright install chromium   # first time only
npm run test:e2e
```

The tests create their own users and reset the rate-limit counters at the start of each run. When the run ends, everything the tests created (users named `e2e-...@example.com`, their crafts, photos, reports, and added list items) is deleted again, so the local database keeps only real and sample data. Docker Compose runs the backend with `AUTO_VERIFY_EMAIL=true`, so new accounts are verified on registration.
