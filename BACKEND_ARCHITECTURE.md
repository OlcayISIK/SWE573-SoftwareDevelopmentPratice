# Indigenous Crafts: Backend Architecture

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architectural Style](#architectural-style)
4. [Project Structure](#project-structure)
5. [Layers](#layers)
6. [Domain Modules](#domain-modules)
7. [Data Model](#data-model)
8. [API Design](#api-design)
9. [Authentication and Authorization](#authentication-and-authorization)
10. [Privacy Rules](#privacy-rules)
11. [Moderation Flow](#moderation-flow)
12. [Notifications](#notifications)
13. [Media Storage](#media-storage)
14. [Error Handling and Responses](#error-handling-and-responses)
15. [Testing Strategy](#testing-strategy)
16. [Configuration](#configuration)
17. [Deployment](#deployment)
18. [Future Extensions](#future-extensions)

---

## Overview

The backend serves a REST API for Indigenous Crafts, an interactive world map where users publish, explore, and discuss indigenous crafts. Guests can browse everything without an account. Registered users publish craft entries directly, favorite entries, follow other users, and report problem content. Admins review reports and edit, hide, or remove entries.

Design goals:

- **Simple to run:** one Django application, one PostgreSQL database, one container.
- **Clear boundaries:** each domain concept lives in its own Django app with a consistent internal layout.
- **Testable business logic:** rules live in services, not in views or model `save()` overrides.
- **Privacy by default:** email is hidden and only general location is public.

---

## Technology Stack

| Concern           | Technology                                   |
| ----------------- | -------------------------------------------- |
| Language          | Python 3.13                                  |
| Web framework     | Django 5.2 LTS + Django REST Framework (DRF) |
| Database          | PostgreSQL 16 (psycopg 3)                    |
| Authentication    | JWT Bearer (djangorestframework-simplejwt)   |
| Password hashing  | Argon2 (`django[argon2]`)                    |
| API documentation | OpenAPI 3 via drf-spectacular (Swagger UI)   |
| Media storage     | Django storage API (local disk, S3-ready)    |
| Static files      | WhiteNoise                                   |
| Cache             | Django database cache (throttle counters)    |
| App server        | Gunicorn                                     |
| Testing           | pytest + pytest-django + factory_boy         |
| Linting           | ruff                                         |
| Import rules      | import-linter                                |
| Containerization  | Docker + Docker Compose                      |

---

## Architectural Style

The backend is a **modular monolith**: one deployable Django project, split into feature apps with explicit boundaries. This keeps deployment and local development simple while still allowing the modules to be separated later if needed.

Background job infrastructure (Celery, Redis) is intentionally left out. Notifications are stored as database rows and read by the client. If email delivery or image processing later slows down requests, a task queue can be added without changing the module structure.

---

## Project Structure

```
backend/
├── manage.py
├── config/                    # Django project
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── core/                      # Shared kernel
│   ├── models.py              # BaseModel (timestamps), SoftDeleteModel
│   ├── exceptions.py          # Domain exceptions mapped to HTTP codes
│   ├── permissions.py         # Shared DRF permission classes
│   ├── pagination.py
│   ├── renderers.py           # Response envelope
│   └── schema.py              # OpenAPI extension for the envelope
├── accounts/                  # Users, profiles, privacy settings
├── crafts/                    # Craft entries, categories, regions, media
├── moderation/                # Reports and admin review actions
├── social/                    # Favorites and follows
├── notifications/             # In-app notifications
├── tests/
├── pyproject.toml
└── Dockerfile
```

Every feature app uses the same internal layout:

```
<app>/
├── models.py          # Data layer
├── selectors.py       # Read queries
├── services.py        # Business logic and write operations
├── serializers.py     # Request and response contracts
├── views.py           # HTTP layer
├── permissions.py     # App-specific permission classes (if any)
├── signals.py         # Events this app emits (if any)
├── receivers.py       # Handlers for other apps' events (if any)
├── urls.py
├── admin.py           # Django admin registration
└── migrations/
```

---

## Layers

Dependencies point in one direction only:

```
views  →  services / selectors  →  models  →  core
   ↘ serializers
```

| Layer       | Responsibility                                                         | Must not                           |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------- |
| Views       | Parse requests, apply permissions, call services, return responses     | Contain business rules or queries  |
| Serializers | Validate input, shape output                                           | Write to the database              |
| Services    | Business rules, write operations, transactions, cross-module calls     | Know about HTTP requests           |
| Selectors   | Read-only queries, filtering, `select_related` / `prefetch_related`    | Change data                        |
| Models      | Table mapping, constraints, simple derived properties                  | Call other modules                 |
| Core        | Base model, exceptions, permissions, pagination, response envelope     | Import any feature app             |

Services take plain arguments (user, ids, validated data), which makes them callable from views, the Django admin, management commands, and tests in the same way.

### Module Boundaries

Feature apps depend on each other in one direction only. A module may import from the modules listed next to it, and from nothing else:

| Module          | May import from                                |
| --------------- | ---------------------------------------------- |
| `accounts`      | `core` only                                    |
| `crafts`        | `accounts`                                     |
| `social`        | `crafts`, `accounts`                           |
| `moderation`    | `crafts`, `accounts`                           |
| `notifications` | `social`, `moderation`, `crafts`, `accounts`   |

- **Foreign keys are allowed.** A model may reference a model in a module below it, declared by string (`"crafts.Craft"`). Every foreign key in the data model points down this order.
- **Queries and writes belong to the owner.** A module does not build its own queries on another module's models and does not write to them. It calls the owner's selectors for reads and the owner's services for writes. For example, `moderation.services.review_report` hides a craft by calling `crafts.services.hide_craft`.
- **Lower modules announce events instead of calling upward.** `crafts` cannot call `notifications`, because `notifications` sits above it. Instead, `crafts.services.publish_craft` sends the `craft_published` signal and `notifications.receivers` handles it. Signals are sent inside the service's transaction and handled synchronously, so the notification rows commit or roll back together with the change that caused them.

The order is enforced in CI with an import-linter `layers` contract, so an import in the wrong direction fails the build.

---

## Domain Modules

| Module          | Responsibility                                                  | Requirements        |
| --------------- | --------------------------------------------------------------- | ------------------- |
| `accounts`      | Registration with email, login, profile, privacy settings       | FR-02, FR-16 to 19  |
| `crafts`        | Craft entries, categories, regions, attributes, media, browsing | FR-01, FR-03 to 10  |
| `moderation`    | Reporting entries, admin review queue, review history           | FR-11, FR-12        |
| `social`        | Favorites and follows                                           | FR-13, FR-14        |
| `notifications` | Creating and listing in-app notifications                       | FR-15               |

---

## Data Model

All models inherit `core.BaseModel`, which adds `id`, `created_at`, and `updated_at`. `Craft` and `CraftMedia` also inherit `core.SoftDeleteModel`, which adds `is_deleted` (see [Soft Delete and Visibility](#soft-delete-and-visibility)).

### accounts

- **User** (custom user model, `AbstractUser`): `email` (unique, used as login), `role` (`user` or `admin`), `is_email_verified`.
- **Profile** (one-to-one with User): `display_name`, `bio`, `city`, `country`, `avatar`, `show_email` (default `False`).

### crafts

- **Category**: `name`, `slug` (e.g., ceramics, textiles, woodwork, metalwork).
- **Region**: `name`, `country`, `description`.
- **Craft**: `name`, `craft_type`, `category` (FK), `region` (FK), `latitude`, `longitude`, `description`, `production_process`, `how_to_understand`, `cultural_relevance`, `attributes` (`JSONField`), `status` (`published` or `hidden`), `author` (FK User).
- **CraftMedia**: `craft` (FK), `media_type` (`photo`, `video`, `document`), `file` or `url`, `caption`, `alt_text`, `order`.

`attributes` stores craft-specific properties that vary between crafts, for example:

```json
{
  "dimensions_cm": { "height": 20, "width": 20 },
  "colors": ["cobalt blue", "turquoise"],
  "distinguishing_features": "Hand-painted floral motifs under a transparent glaze"
}
```

### moderation

- **Report**: `craft` (FK), `reporter` (FK User), `reason` (`inaccurate`, `inappropriate`, `disrespectful`), `note`, `status` (`open`, `resolved`, `dismissed`). One open report per user per craft, enforced by a partial unique constraint on (`craft`, `reporter`) where `status = open`, so a user can report the same craft again after the earlier report is closed.
- **ReviewAction**: `report` (FK), `admin` (FK User), `action` (`edit`, `hide`, `remove`, `dismiss`), `reason`.

### social

- **Favorite**: `user` (FK), `craft` (FK). Unique on (`user`, `craft`). The row is hard-deleted on unfavorite.
- **Follow**: `follower` (FK User), `following` (FK User). Unique on the pair; a check constraint blocks following yourself. The row is hard-deleted on unfollow.

### notifications

- **Notification**: `recipient` (FK User), `type` (`new_craft_from_followed`, `favorite_updated`, `report_resolved`), `craft` (FK, nullable), `actor` (FK User, nullable), `data` (`JSONField` with extra context, for example the review action and report status for `report_resolved`), `is_read`.

### Indexes

- `Craft(category)`, `Craft(region)`, and `Craft(latitude, longitude)` for map and filter queries.
- `Notification(recipient, is_read)` for the unread count.
- `Report(status)` for the admin queue.

### Soft Delete and Visibility

Only craft content is soft-deleted, because it is the content that moderation removes and that may need to be reviewed or restored.

- **Soft-deleted models:** `Craft` and `CraftMedia`. Calling `delete()` on an instance or on a QuerySet sets `is_deleted` instead of removing the row. The default manager excludes deleted rows, and a second manager (`all_objects`) returns every row for the Django admin and audit use.
- **Everything else:** `Favorite` and `Follow` rows are hard-deleted, so their unique constraints never block favoriting or following again. `Report`, `ReviewAction`, and `Notification` rows are kept. Accounts are deactivated with `is_active` rather than deleted, so the unique `email` is never left behind on a deleted row.
- **Limit of the manager filter:** the default manager only filters queries that start from `Craft`. A query that reaches a craft through a foreign key (a favorite, a notification, a report) still sees deleted and hidden crafts.

Because of that limit, craft visibility is defined once and reused:

- `crafts.selectors.visible_crafts(viewer)` returns the crafts a viewer may see: not deleted, and either `published` or owned by the viewer. Admins also see hidden crafts.
- Every public craft query starts from this selector.
- Selectors in other modules restrict by it instead of repeating the conditions. For example, `/me/favorites/` lists favorites where `craft__in=visible_crafts(viewer)`.
- A notification is kept when its craft is hidden or removed, but its `craft` is returned as `null` if the recipient can no longer see it.

---

## API Design

All endpoints are under `/api/v1/`. List endpoints are paginated, except the small reference lists (`/categories/` and `/regions/`), which return every row so the frontend can fill its filters in one request. `/regions/` accepts an optional `country` filter.

| Method | Endpoint                               | Access          | Purpose                               |
| ------ | -------------------------------------- | --------------- | ------------------------------------- |
| POST   | `/auth/register/`                      | Guest           | Register with email                   |
| POST   | `/auth/verify-email/`                  | Guest           | Confirm email address                 |
| POST   | `/auth/verify-email/resend/`           | Guest           | Send a new verification email         |
| POST   | `/auth/token/`                         | Guest           | Log in, get access and refresh tokens |
| POST   | `/auth/token/refresh/`                 | Guest           | Refresh access token                  |
| POST   | `/auth/logout/`                        | Guest           | Blacklist the refresh token           |
| POST   | `/auth/password-reset/`                | Guest           | Request a password reset email        |
| POST   | `/auth/password-reset/confirm/`        | Guest           | Set a new password with the token     |
| GET    | `/crafts/`                             | Public          | List crafts (filter by category, region, country, search) |
| GET    | `/crafts/map/`                         | Public          | Lightweight pins for the map (same filters, plus `bbox=west,south,east,north`) |
| GET    | `/crafts/{id}/`                        | Public          | Craft details                         |
| POST   | `/crafts/`                             | Registered user | Publish a craft                       |
| PATCH  | `/crafts/{id}/`                        | Author or admin | Edit a craft                          |
| DELETE | `/crafts/{id}/`                        | Author or admin | Soft delete a craft                   |
| POST   | `/crafts/{id}/media/`                  | Author          | Upload photo, video, or document      |
| DELETE | `/crafts/{id}/media/{media_id}/`       | Author or admin | Remove a media item                   |
| GET    | `/categories/`, `/regions/`            | Public          | Reference data for filters            |
| POST   | `/crafts/{id}/report/`                 | Registered user | Report a craft                        |
| GET    | `/moderation/reports/`                 | Admin           | Review queue (`status=open` by default; also `resolved`, `dismissed`, `all`) |
| GET    | `/moderation/reports/{id}/`            | Admin           | Report details with its review history |
| POST   | `/moderation/reports/{id}/actions/`    | Admin           | Edit, hide, remove, or dismiss        |
| GET    | `/crafts/{id}/favorite/`               | Public          | Favorite status and count             |
| POST   | `/crafts/{id}/favorite/`               | Registered user | Favorite (DELETE to unfavorite)       |
| GET    | `/me/favorites/`                       | Registered user | List own favorites                    |
| GET    | `/users/{id}/follow/`                  | Public          | Follow status and follower counts     |
| POST   | `/users/{id}/follow/`                  | Registered user | Follow (DELETE to unfollow)           |
| GET    | `/users/{id}/`                         | Public          | Public profile                        |
| GET    | `/users/{id}/crafts/`                  | Public          | Crafts added by a user                |
| GET    | `/me/`                                 | Registered user | Own profile and settings              |
| PATCH  | `/me/`                                 | Registered user | Update profile and privacy settings   |
| GET    | `/me/notifications/`                   | Registered user | List notifications (`unread=true` for unread only) |
| GET    | `/me/notifications/unread-count/`      | Registered user | Unread count for the notification bell |
| POST   | `/me/notifications/read/`              | Registered user | Mark notifications as read (given `ids`, or all) |

The OpenAPI schema is served at `/api/schema/` and Swagger UI at `/api/docs/`.

### Throttling

DRF throttle classes limit request rates. Anonymous and authenticated clients have default rates, and stricter scoped rates apply to the endpoints most open to abuse: registration, login, token refresh, resending the verification email, password reset, and reporting a craft.

Throttle counters are stored in Django's database cache, so the limits hold across Gunicorn workers without adding another service.

---

## Authentication and Authorization

### Authentication

- Users register with email and password. A verification email is sent, and the account can publish only after verification.
- The verification email is sent with `transaction.on_commit()`, after the account is saved. A failed send is logged and does not fail the registration; the user can request a new email from `/auth/verify-email/resend/`.
- Login returns a short-lived access token (15 minutes) and a refresh token (7 days).
- Refresh tokens are rotated and the used token is blacklisted (`ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`, and the `token_blacklist` app), so a refresh token stops working once it has been exchanged.
- Token claims carry `user_id` and `role`. The role claim is for the frontend only (for example, to show admin screens). The backend loads the user from the database on every request, and permission classes and services read the role from that user, so a role change or deactivation takes effect on the next request.
- Logout blacklists the refresh token, so it cannot be used again.
- Password reset uses a single-use, time-limited token sent by email. The response is the same whether or not the email is registered. A successful reset blacklists every outstanding refresh token for the user, and access tokens carry a password-hash claim (`CHECK_REVOKE_TOKEN`), so all existing sessions end.
- Passwords are hashed with Argon2.

### Roles

| Capability                          | Guest | Registered user | Admin |
| ----------------------------------- | :---: | :-------------: | :---: |
| Browse map, crafts, public profiles |  Yes  |       Yes       |  Yes  |
| Publish, edit, delete own crafts    |       |       Yes       |  Yes  |
| Favorite, follow, report            |       |       Yes       |  Yes  |
| Edit own profile and privacy        |       |       Yes       |  Yes  |
| Review reports, hide or remove any craft |  |                 |  Yes  |

Permissions are enforced with DRF permission classes in views (`IsAuthenticated`, `IsAuthorOrAdmin`, `IsAdmin`), and services check them again for operations that can be called from places other than views.

---

## Privacy Rules

Privacy is enforced in serializers, so restricted data is never sent to the client.

- **Email:** `PublicProfileSerializer` includes `email` only if `show_email` is `True`. The default is `False`.
- **Location:** profiles store only `city` and `country`. There is no field for a precise address, so it cannot be leaked.
- **Own data:** `/me/` uses a separate `OwnProfileSerializer` that returns all fields to the owner.

---

## Moderation Flow

Publishing does not require approval (FR-10). Accuracy is maintained after publication through reports and admin review.

```
User reports craft ──▶ Report (open) ──▶ Admin review queue
                                             │
              ┌──────────────┬──────────────┼──────────────┐
              ▼              ▼              ▼              ▼
            edit           hide          remove         dismiss
              │              │              │              │
              └──────────────┴──────┬───────┴──────────────┘
                                    ▼
                    ReviewAction recorded, Report closed,
                    reporter notified
```

- `hide` sets `Craft.status = hidden`. Hidden crafts are excluded from public queries but remain visible to the author and admins (see [Soft Delete and Visibility](#soft-delete-and-visibility)).
- `remove` soft deletes the craft.
- `edit` takes a `changes` object, validated with the same rules as a normal craft edit.
- `hide` and `remove` also close every other open report on the same craft, each with its own `ReviewAction`, because the reported content is no longer public. `edit` and `dismiss` close only the reviewed report.
- A report can be reviewed once; reviewing a closed report returns `409 Conflict`.
- Every action is stored as a `ReviewAction` with the admin and reason, which gives a full audit history.
- Admins can work through the API or the Django admin; both call the same `moderation.services` functions.

---

## Notifications

Notifications are created synchronously, within the same database transaction as the change that triggers them. The triggering service sends a Django signal and `notifications.receivers` creates the rows, so `crafts` and `moderation` do not depend on `notifications` (see [Module Boundaries](#module-boundaries)).

| Event                        | Signal (sent by)                                          | Recipients             |
| ---------------------------- | --------------------------------------------------------- | ---------------------- |
| User publishes a craft       | `craft_published` (`crafts.services.publish_craft`)       | Followers              |
| A favorited craft is updated | `craft_updated` (`crafts.services.update_craft`)          | Users who favorited it |
| A report is resolved         | `report_resolved` (`moderation.services.review_report`)   | The reporter           |

Recipients are read through `social.selectors` (followers of the author, users who favorited the craft). Notifications are created with `bulk_create`. The client polls `/me/notifications/unread-count/` to show the unread count, which is a single indexed count query. If follower counts grow large enough to slow down publishing, this is the first place to introduce a background task queue.

---

## Media Storage

- Files are saved through Django's storage API. Development uses local disk; production can switch to S3-compatible storage by changing the `STORAGES` setting, with no code changes.
- Uploads are validated for file type and size in the serializer (photos: JPEG, PNG, WebP up to 5 MB; profile avatars: the same formats up to 2 MB; documents: PDF up to 10 MB).
- Videos are stored as external links (e.g., YouTube) rather than uploaded files, to avoid large uploads and transcoding.
- Every photo requires `alt_text` (NFR-05).
- A craft can have at most 20 media items. Uploaded files are renamed to random names, so the original filename is never exposed.
- The first photo (by `order`) is returned as `cover_photo` in craft lists.

---

## Error Handling and Responses

Successful responses and errors share one envelope:

```json
{
  "success": true,
  "data": { },
  "message": "OK"
}
```

```json
{
  "success": false,
  "data": null,
  "message": "Craft not found",
  "errors": { }
}
```

Services raise domain exceptions from `core.exceptions` (`NotFoundError`, `PermissionDeniedError`, `ValidationError`, `ConflictError`). A custom DRF exception handler converts them to the envelope with the matching HTTP status, so views contain no error-handling code.

drf-spectacular builds the schema from serializers and does not see the renderer. A small extension in `core/schema.py` wraps every documented response in the envelope, so Swagger UI shows the real response shape.

Paginated lists return:

```json
{
  "items": [],
  "total": 120,
  "page": 1,
  "pageSize": 20,
  "totalPages": 6
}
```

---

## Testing Strategy

| Level       | What is tested                                          | Tools                     |
| ----------- | ------------------------------------------------------- | ------------------------- |
| Unit        | Services and selectors: business rules, permissions     | pytest, factory_boy       |
| API         | Endpoints: status codes, permissions, privacy filtering | DRF `APIClient`           |
| Integration | Full flows, e.g., publish, report, admin hide           | pytest with a test database |

Tests run against PostgreSQL (not SQLite) so constraints and `JSONField` behave as in production. Privacy rules (FR-17, FR-18), role permissions, and craft visibility (hidden and removed crafts) have dedicated tests.

---

## Configuration

Settings are split into `base`, `development`, and `production`. Values come from environment variables through `django-environ`.

```env
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=change-me
DJANGO_ALLOWED_HOSTS=api.example.com
DATABASE_URL=postgres://user:password@db:5432/indigenous_crafts
JWT_SIGNING_KEY=change-me
CORS_ALLOWED_ORIGINS=https://example.com
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=change-me
EMAIL_HOST_PASSWORD=change-me
```

Secrets are never committed. A `.env.example` file documents the required variables.

---

## Deployment

The application runs as a single instance.

- **Local development:** Docker Compose starts two containers, `backend` and `db` (PostgreSQL).
- **Image:** multi-stage Docker build. The runtime stage uses a slim Python image, runs as a non-root user, and contains no build tools.
- **Startup:** the entrypoint runs `python manage.py migrate --noinput`, then `createcachetable`, then `collectstatic`, then starts Gunicorn. With one instance there is no risk of concurrent migrations.
- **Admin account:** created once with `python manage.py createsuperuser`, then given the `admin` role.
- **Maintenance:** `python manage.py flushexpiredtokens` runs daily (host cron or the platform's scheduler) to clear expired entries from the token blacklist.

---

## Future Extensions

- **AI assistance layer (FR-20):** an `ai` app that suggests descriptions and categories and flags possible issues for admin review. It would be called from `crafts.services` behind an interface, so it can be added or disabled without changing other modules.
- **Background tasks:** add a task queue if email sending, image resizing, or follower notifications slow down requests.
- **Geospatial queries:** switch latitude and longitude to PostGIS if the map needs radius or bounding-box search at scale.
