# Indigenous Crafts: Frontend Architecture

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architectural Style](#architectural-style)
4. [Project Structure](#project-structure)
5. [Layers](#layers)
6. [Routing and Pages](#routing-and-pages)
7. [State Management](#state-management)
8. [API Communication](#api-communication)
9. [Authentication](#authentication)
10. [Authorization in the UI](#authorization-in-the-ui)
11. [Map](#map)
12. [Forms and Validation](#forms-and-validation)
13. [Media Uploads](#media-uploads)
14. [Notifications](#notifications)
15. [Responsive Design and Accessibility](#responsive-design-and-accessibility)
16. [Error Handling](#error-handling)
17. [Testing Strategy](#testing-strategy)
18. [Configuration](#configuration)
19. [Deployment](#deployment)
20. [Future Extensions](#future-extensions)

---

## Overview

The frontend is a single-page application (SPA) built with React. It talks to the Django REST API and presents the interactive world map, craft entries, user profiles, and the admin moderation screens.

Design goals:

- **Map first:** the map is the home page and the main way to explore crafts.
- **Usable without an account:** guests can browse everything (FR-01). Sign-in is requested only when a guest tries to publish, favorite, follow, or report.
- **Feature-based structure:** code is grouped by feature, matching the backend modules.
- **Server state in one place:** data from the API is fetched, cached, and refreshed through one library, not copied into global stores.
- **Accessible and responsive:** works on mobile and desktop (NFR-03), with a list alternative to the map for keyboard and screen reader users (NFR-05).

---

## Technology Stack

| Concern              | Technology                                        |
| -------------------- | ------------------------------------------------- |
| Language             | TypeScript                                        |
| UI library           | React 19                                          |
| Build tool           | Vite                                              |
| Routing              | React Router                                      |
| Server state         | TanStack Query                                    |
| Client state         | React context (auth session only)                 |
| HTTP client          | Axios                                             |
| Forms and validation | React Hook Form + Zod                             |
| Map                  | Leaflet + react-leaflet, OpenStreetMap tiles      |
| Marker clustering    | Leaflet.markercluster                             |
| Styling              | Tailwind CSS                                      |
| API types            | openapi-typescript (generated from the backend schema) |
| Testing              | Vitest + React Testing Library + MSW              |
| End-to-end testing   | Playwright                                        |
| Linting and format   | ESLint + Prettier                                 |
| Serving              | Nginx (static files in a Docker container)        |

---

## Architectural Style

The frontend is a client-rendered SPA organized by feature. Each feature folder owns its pages, components, API calls, and types, which mirrors the backend modules (`accounts`, `crafts`, `moderation`, `social`, `notifications`).

Server-side rendering (for example, Next.js) is intentionally not used. The content does not need search engine indexing for the course scope, and an SPA served as static files keeps deployment to one simple container.

---

## Project Structure

```
frontend/
├── index.html
├── vite.config.ts
├── package.json
├── .env.example
├── Dockerfile
├── nginx.conf
├── src/
│   ├── main.tsx                # Entry point: providers and router
│   ├── app/
│   │   ├── router.tsx          # Route definitions
│   │   ├── providers.tsx       # QueryClient, AuthProvider
│   │   └── layouts/            # MainLayout, AdminLayout
│   ├── api/
│   │   ├── client.ts           # Axios instance, interceptors, token refresh
│   │   ├── envelope.ts         # Unwraps the backend response envelope
│   │   └── schema.d.ts         # Generated API types (openapi-typescript)
│   ├── features/
│   │   ├── auth/               # Register, login, verify email, password reset
│   │   ├── crafts/             # Map, craft list, craft details, craft form
│   │   ├── profiles/           # Public profile, own profile and privacy settings
│   │   ├── social/             # Favorite and follow buttons, favorites list
│   │   ├── moderation/         # Report dialogs, admin review of crafts and items
│   │   └── notifications/      # Notification bell and list
│   ├── components/             # Shared UI: Button, Modal, Pagination, EmptyState
│   ├── hooks/                  # Shared hooks
│   ├── lib/                    # Helpers: formatting, constants
│   └── styles/
└── tests/
    └── e2e/                    # Playwright tests
```

Every feature folder uses the same layout:

```
features/<feature>/
├── api.ts             # Functions that call the backend
├── queries.ts         # TanStack Query hooks (useCraft, usePublishCraft, ...)
├── types.ts           # Feature types, based on the generated API types
├── schemas.ts         # Zod schemas for forms (if any)
├── components/        # Components used only by this feature
└── pages/             # Route-level components
```

---

## Layers

Dependencies point in one direction only:

```
pages  →  components  →  queries  →  api  →  api/client
```

| Layer      | Responsibility                                         | Must not                          |
| ---------- | ------------------------------------------------------ | --------------------------------- |
| Pages      | Read route parameters, compose components, set layout  | Call Axios directly               |
| Components | Render UI, handle user interaction                     | Call Axios directly               |
| Queries    | Caching, loading and error states, cache invalidation  | Render UI                         |
| API        | HTTP calls for one feature, map request and response types | Hold state                    |
| API client | Base URL, auth header, token refresh, envelope unwrapping | Know about features            |

Features may use shared `components`, `hooks`, and `lib`. A feature may use another feature's exported components (for example, `crafts` shows the `FavoriteButton` from `social`), but never another feature's `api.ts` directly.

---

## Routing and Pages

| Route                         | Page                          | Access          | Requirements    |
| ----------------------------- | ----------------------------- | --------------- | --------------- |
| `/`                           | Map (home)                    | Public          | FR-01, FR-07    |
| `/crafts`                     | Craft list with filters       | Public          | FR-03, FR-09    |
| `/crafts/:id`                 | Craft details                 | Public          | FR-05 to FR-08  |
| `/crafts/new`                 | Publish a craft               | Registered user | FR-04 to FR-10  |
| `/crafts/:id/edit`            | Edit a craft                  | Author or admin | FR-10           |
| `/users/:id`                  | Public profile and their crafts | Public        | FR-19           |
| `/me`                         | Own profile                   | Registered user | FR-16           |
| `/me/settings`                | Profile and privacy settings  | Registered user | FR-17, FR-18    |
| `/me/favorites`               | Favorites                     | Registered user | FR-13           |
| `/me/notifications`           | Notifications                 | Registered user | FR-15           |
| `/register`                   | Register                      | Guest           | FR-02           |
| `/login`                      | Log in                        | Guest           | FR-02           |
| `/verify-email`               | Confirm email (link target)   | Guest           | FR-02           |
| `/password-reset`             | Request and confirm reset     | Guest           | FR-02           |
| `/admin/reports`              | Reported crafts               | Admin           | FR-11, FR-12    |
| `/admin/reports/:id`          | Review a craft report         | Admin           | FR-12           |
| `/admin/item-reports`         | Reported lookup items         | Admin           | FR-11, FR-12    |
| `/admin/item-reports/:id`     | Review an item report         | Admin           | FR-12           |
| `*`                           | Not found                     | Public          |                 |

Routes are lazy-loaded with `React.lazy`, so the map library and the admin screens are only downloaded when needed.

Protected routes are wrapped in route guards:

- `RequireAuth` redirects guests to `/login` and returns them to the original page after login.
- `RequireAdmin` shows a "not authorized" page to non-admin users.

Map filters and list filters (category, craft type, culture, country, search, page) are kept in the URL query string, so filtered views can be shared and the back button works.

---

## State Management

State is split by where it comes from:

| Kind of state       | Where it lives                    | Examples                                   |
| ------------------- | --------------------------------- | ------------------------------------------ |
| Server state        | TanStack Query cache              | Crafts, profiles, favorites, notifications |
| Session state       | `AuthContext`                     | Current user, access token, sign-in status |
| URL state           | Query string                      | Filters, search term, page number          |
| Form state          | React Hook Form                   | Craft form, settings form                  |
| Local UI state      | `useState` in the component       | Open dialogs, selected map pin             |

No global store such as Redux is used. Server data is never copied into context or component state, so the cache stays the single source of truth.

After a write, the matching queries are invalidated so the UI refetches fresh data. For example, publishing a craft invalidates the map pins and the craft list. Favoriting and following use optimistic updates so the button responds immediately, and they roll back if the request fails.

---

## API Communication

### API client

`api/client.ts` creates one Axios instance with:

- `baseURL` from `VITE_API_BASE_URL` (for example, `https://api.example.com/api/v1`).
- A request interceptor that adds `Authorization: Bearer <access token>` when the user is signed in.
- A response interceptor that unwraps the envelope and handles expired tokens (see [Authentication](#authentication)).

### Response envelope

The backend wraps every response:

```json
{ "success": true, "data": { }, "message": "OK" }
```

`api/envelope.ts` returns `data` on success and throws an `ApiError` (with `status`, `message`, and field `errors`) on failure. Feature code receives plain data and never handles the envelope itself.

Paginated endpoints return `items`, `total`, `page`, `pageSize`, and `totalPages` inside `data`. A shared `usePaginatedQuery` helper and `Pagination` component work with this shape.

### Types

API types are generated from the backend OpenAPI schema (`/api/schema/`) with openapi-typescript, using `npm run generate:api`. This keeps frontend types in sync with the backend, and a backend change that breaks the frontend shows up as a type error.

---

## Authentication

### Tokens

The backend issues a short-lived access token (15 minutes) and a refresh token (7 days). Refresh tokens are rotated, and a used refresh token is blacklisted.

- **Access token:** kept in memory only (in `AuthContext`), never in `localStorage`.
- **Refresh token:** kept in `localStorage`, so the session survives a page reload.

Keeping the refresh token in `localStorage` means a cross-site scripting (XSS) bug could expose it. This is accepted for the course scope and reduced by rotation, blacklisting, a strict Content Security Policy, and never rendering user content as raw HTML. Moving the refresh token to an `httpOnly` cookie would remove this risk but needs backend changes; it is listed under [Future Extensions](#future-extensions).

### Refresh flow

1. A request returns `401` because the access token expired.
2. The response interceptor calls `/auth/token/refresh/` with the refresh token.
3. The new access and refresh tokens are saved, and the original request is retried once.
4. If the refresh fails, the session is cleared and the user is sent to `/login`.

Because each refresh token works only once, refreshing is **single-flight**: if several requests fail at the same time, only the first one calls the refresh endpoint and the others wait for its result. Without this, the second refresh call would use an already-blacklisted token and log the user out.

On page load, the app uses the stored refresh token to get a new access token, then loads the current user from `/me/`.

### Logout

Logout clears the tokens from memory and `localStorage` and clears the TanStack Query cache, so no data from the previous user remains on a shared device.

---

## Authorization in the UI

The UI hides or disables actions the user is not allowed to take, but this is only for usability. The backend enforces every permission.

| UI element                    | Shown to                  |
| ----------------------------- | ------------------------- |
| Publish button                | Signed-in users (prompts guests to sign in) |
| Favorite, follow, report      | Signed-in users (prompts guests to sign in) |
| Edit and delete on a craft    | The author and admins     |
| Admin menu and review queue   | Admins                    |

The user's role is read from the `/me/` response, not decoded from the JWT, so it always matches what the backend uses.

Users must verify their email before publishing. If an unverified user opens `/crafts/new`, the page explains this and offers to resend the verification email.

---

## Map

- **Library:** Leaflet with react-leaflet and OpenStreetMap tiles. Leaflet is free, has no API key, and is enough for pins, zoom, and pan. The OpenStreetMap attribution is shown on the map, as its license requires.
- **Data:** the map loads lightweight pins from `/crafts/map/` (id, name, category, latitude, longitude). Full craft data is loaded only when a pin is opened.
- **Clustering:** nearby pins are grouped with Leaflet.markercluster, so the map stays readable and fast as the number of crafts grows (NFR-02).
- **Filters:** category, craft type (listed for the chosen category, and cleared when it changes), culture, country, and search update the URL and refetch the pins. The country list comes from `/crafts/countries/`, so it only offers countries that have crafts.
- **Pin details:** clicking a pin opens a preview card (photo, name, craft type, culture, and place) with a link to the craft details page. On mobile the preview opens as a bottom sheet.
- **Picking a location:** the craft form includes a small map. The author types an address and pins it (the map moves to the found point), or clicks or drags the pin and the address is filled in from the point.
- **Performance:** the map component is lazy-loaded, and pin data is cached by TanStack Query so returning to the map does not refetch immediately.

---

## Forms and Validation

Forms use React Hook Form with Zod schemas.

- Zod schemas give instant feedback in the browser (required fields, lengths, file types and sizes).
- The backend validates everything again. Field errors in the error envelope (`errors`) are mapped back to the matching form fields, so server errors appear next to the right input.

The craft form follows the craft data model:

- **Basics:** name, category, craft type, and culture, each picked from a lookup list. The craft types follow the chosen category, and cultures show their homeland.
- **Adding to the lists:** each list has an "Add a new …" control that adds the item for everyone and picks it. Adding a name that already exists picks the existing item.
- **Location:** the address with a "Pin address" button, which looks up the coordinates through the backend (`/geocode/search/`) and shows "Address not found." when nothing matches. Placing the pin on the map fills in the address (`/geocode/reverse/`). City and country come from the lookup.
- **Tools and materials:** the items typical for the chosen craft type are offered as checkboxes, and any other item is found by typing its name, or added as a new one.
- **Description:** one text covering what it is, how it is made, how to understand it, and its cultural relevance (FR-05).
- **Colors:** up to 10 rows, each with a color picker, a code field, and an opacity slider. The code accepts hex (`#14a`, `#1e40af`, `#1e40af80`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, and CSS color names, and the picker, code, and opacity stay in step. Colors are sent as `#rrggbb`, or `#rrggbbaa` when see-through, and shown on the craft page as swatches with their codes.
- **Attributes:** optional dimension rows (measure, size, and unit, each measure once), weight, and distinguishing features, stored in the backend `attributes` field (FR-07).
- **Media:** photos, video links, and documents (FR-06).

Long forms save a draft in `localStorage`, so an author does not lose their work if the page reloads.

The craft page shows a facts card with the category, craft type, culture (with its homeland), tools, materials, and place. Each one links to the list of crafts that share it.

Items that users added to the lookup lists can be reported from the facts card, with their own reasons (duplicate, inaccurate, inappropriate). Admins review them under "Reported items": the page shows who added the item and how many crafts use it, and offers rename, hide, merge into another item of the same kind (confirmed first, since it moves the crafts and deletes the item), or dismiss.

---

## Media Uploads

- Photos and documents are uploaded with `multipart/form-data` to `/crafts/{id}/media/`, with a progress indicator.
- The browser checks file type and size before upload, matching the backend limits (photos: JPEG, PNG, WebP up to 5 MB; documents: PDF up to 10 MB).
- Every photo requires alt text (NFR-05). The form does not let a photo be saved without it.
- Videos are entered as links (for example, YouTube) and shown with an embedded player.
- Images are lazy-loaded and shown with fixed dimensions to avoid layout shifts.

---

## Notifications

- The notification bell shows the unread count, refreshed by polling `/me/notifications/` every 60 seconds while the tab is visible (TanStack Query `refetchInterval`, paused in background tabs).
- Opening the notification list marks the notifications as read.
- If a notification's craft was hidden or removed, the backend returns `craft` as `null`, and the UI shows the notification without a link.

---

## Responsive Design and Accessibility

### Responsive design (NFR-03)

- Mobile-first layouts with Tailwind breakpoints.
- On mobile, the map fills the screen, filters open in a drawer, and pin previews open as bottom sheets.

### Accessibility (NFR-05)

- **Map alternative:** an interactive map is hard to use with a keyboard or screen reader, so every map view has a "View as list" option showing the same crafts in an accessible list.
- Semantic HTML (`nav`, `main`, headings in order) and labels on every form field.
- All interactive elements are reachable and usable with the keyboard, with a visible focus outline.
- Dialogs trap focus and close with Escape.
- Text and controls meet WCAG AA color-contrast levels.
- Every image has alt text, which the upload form enforces.
- Automated checks with `eslint-plugin-jsx-a11y` and axe in tests.

---

## Error Handling

| Error                     | Handling                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Field validation (`400`)  | Shown next to the matching form fields                      |
| Not signed in (`401`)     | Token refresh, then redirect to login if refresh fails      |
| Not allowed (`403`)       | "Not authorized" message                                    |
| Not found (`404`)         | Not found page (also used for hidden or removed crafts)     |
| Too many requests (`429`) | Message asking the user to wait and try again               |
| Server or network error   | Toast with a retry option                                   |
| Rendering error           | Error boundary per route, so one broken page does not break the app |

---

## Testing Strategy

| Level       | What is tested                                             | Tools                          |
| ----------- | ---------------------------------------------------------- | ------------------------------ |
| Unit        | Helpers, Zod schemas, envelope handling                    | Vitest                         |
| Component   | Components and pages with mocked API responses             | React Testing Library + MSW    |
| End-to-end  | Key flows against the real backend: register, publish, report, admin hide, report and merge an added tool | Playwright      |

The token refresh flow, including the single-flight behavior, has dedicated tests. Route guards and role-based UI (guest, registered user, admin) are tested at the component level.

---

## Configuration

Configuration comes from Vite environment variables, which are built into the static files at build time.

```env
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

Because these values end up in the browser, they must never contain secrets. A `.env.example` file documents the variables.

---

## Deployment

- **Build:** `npm run build` produces static files in `dist/`.
- **Image:** multi-stage Docker build. The build stage uses a Node image to install dependencies and build; the runtime stage is a small Nginx image that serves `dist/`.
- **Routing:** Nginx falls back to `index.html` for unknown paths, so React Router handles deep links such as `/crafts/12`.
- **Caching:** hashed asset files are cached long-term; `index.html` is not cached, so users get new releases immediately.
- **Security headers:** Nginx sets a Content Security Policy and other security headers.
- **Local development:** Docker Compose runs the frontend alongside the backend and database. During development, the Vite dev server proxies `/api` to the backend to avoid CORS issues.

---

## Future Extensions

- **Refresh token in an httpOnly cookie:** removes the XSS exposure of `localStorage`, with backend changes to set and read the cookie.
- **AI assistance (FR-20):** suggested descriptions and categories in the craft form, shown as suggestions the author can accept or edit.
- **Internationalization:** Turkish and English interfaces with react-i18next.
- **Real-time notifications:** replace polling with WebSockets or server-sent events if needed.
- **Offline support:** a service worker to cache recently viewed crafts.
