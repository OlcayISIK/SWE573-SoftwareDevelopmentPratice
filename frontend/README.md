# Indigenous Crafts Frontend

React single-page app for Indigenous Crafts, built with TypeScript and Vite.

## Run with Docker

From the repository root, `docker compose up --build` starts the database, the backend, and this app at http://localhost:5173.

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
