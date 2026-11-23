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
15. [Logging and Monitoring](#logging-and-monitoring)
16. [Testing Strategy](#testing-strategy)
17. [Configuration](#configuration)
18. [Deployment](#deployment)
19. [Future Extensions](#future-extensions)

---

## Overview

The backend serves a REST API for Indigenous Crafts, an interactive world map where users publish, explore, and discuss indigenous crafts. Guests can browse everything without an account. Registered users publish craft entries directly, share their own stories about crafts, add missing items to the shared lists, favorite entries, follow other users, and report problem content. Admins review reports and edit, hide, remove, or merge content.

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
| Cache             | Django database cache (throttle counters, address lookups) |
| CORS              | django-cors-headers                          |
| Address lookup    | OpenStreetMap Nominatim, called from the backend |
| Logging           | One JSON line per request, streamed to Better Stack |
| App server        | Gunicorn                                     |
| Testing           | pytest + pytest-django + factory_boy         |
| Linting           | ruff                                         |
| Import rules      | import-linter                                |
| Containerization  | Docker + Docker Compose                      |
| Hosting           | Render (Docker web service, PostgreSQL)      |
| CI/CD             | GitHub Actions                               |

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
│   │   ├── production.py
│   │   └── test.py
│   ├── urls.py
│   └── wsgi.py
├── core/                      # Shared kernel
│   ├── models.py              # BaseModel (timestamps), SoftDeleteModel
│   ├── exceptions.py          # Domain exceptions mapped to HTTP codes
│   ├── permissions.py         # Shared DRF permission classes
│   ├── pagination.py
│   ├── renderers.py           # Response envelope
│   ├── schema.py              # OpenAPI extension for the envelope
│   ├── validators.py          # Upload checks shared by apps
│   ├── middleware.py          # Request logging
│   ├── logs.py                # JSON log formatter
│   └── views.py               # Health check
├── accounts/                  # Users, profiles, privacy settings
├── crafts/                    # Craft entries, lookup lists, places, colors, media, stories
│   ├── colors.py              # Maps a color to one of 12 main colors
│   ├── geocoding.py           # Address lookup through Nominatim
│   ├── samples.py             # Loads and removes the sample crafts
│   ├── sample_data/           # Sample crafts, photos, and their credits
│   └── management/commands/   # load_sample_crafts
├── moderation/                # Reports on crafts, list items, and stories; admin review
├── social/                    # Favorites and follows
├── notifications/             # In-app notifications
├── tests/
├── entrypoint.sh              # Migrate, prepare, and start Gunicorn
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
| `crafts`        | Craft entries, places, lookup lists, attributes, dates, colors, media, stories, search and browsing, address lookup | FR-01, FR-03 to 10, FR-21 to 29 |
| `moderation`    | Reports on crafts, list items, and stories; admin review queues; review history | FR-11, FR-12        |
| `social`        | Favorites and follows                                           | FR-13, FR-14        |
| `notifications` | Creating and listing in-app notifications                       | FR-15               |
| `core`          | Shared models, permissions, errors, envelope, request logging, health check | NFR-06, NFR-09 to 11 |

Requirement IDs refer to the Software Requirements Specification v1.0 (`docs/Indigenous_Crafts_SRS_v1.0.pdf`).

---

## Data Model

All models inherit `core.BaseModel`, which adds `id`, `created_at`, and `updated_at`. `Craft`, `CraftMedia`, and `CraftStory` also inherit `core.SoftDeleteModel`, which adds `is_deleted` (see [Soft Delete and Visibility](#soft-delete-and-visibility)).

### accounts

- **User** (custom user model, `AbstractUser`): `email` (unique, used as login), `role` (`user` or `admin`), `is_email_verified`.
- **Profile** (one-to-one with User): `display_name`, `bio`, `city`, `country`, `avatar`, `show_email` (default `False`).

### crafts

- **Lookup lists**: `Category`, `CraftType`, `Tool`, `Material`, and `Culture` share `name`, `description` (up to 300 characters, shown when a user hovers over or focuses the item), `is_hidden`, and `created_by` (FK User, nullable).
  - **Category** adds `slug` (e.g., ceramics, textiles, woodwork, metalwork) and `icon`, one of a fixed set of 24 icon names (e.g., `spool`, `amphora`, `fish`) that the frontend draws on chips, cards, and map pins. Users pick the icon when they add a category, `sparkles` by default; any other name is rejected. A migration gave the seeded categories their icons. Category lists, filter counts, and map pins (`category_icon`) include the icon.
  - **CraftType** belongs to a `category` (e.g., Textiles has Carpet, Kilim, Felt).
  - **Tool** and **Material** are linked many-to-many to the craft types they are typical for, so the form can suggest them first. Any tool or material can still be picked for any craft.
  - **Culture** adds `homeland` (e.g., Diné (Navajo), Southwestern United States).
  - Names are unique ignoring case (per category for craft types), so "carpet" and "Carpet" stay one item.
  - The lists are seeded by data migrations, so a new database starts with them. Seeded items have no `created_by`, and every seeded item has a description.
  - Registered users with a verified email can add items, and everyone can use them right away. A user can describe the item they add. Adding a name that already exists returns the existing item, with its own description. Admins hide items with `is_hidden`, which removes them from the lists; a hidden name cannot be added again.
- **Craft**: `name`, `category` (FK), `craft_type` (FK, must belong to the category), `tools` and `materials` (many-to-many, optional), `culture` (FK, required for new crafts), `address`, `city`, `country`, `latitude`, `longitude` (a copy of the main place, see CraftPlace), `description` (what the craft is and how it is made), `story` (optional: how to understand it, its history and meaning, and its role in the community), `attributes` (`JSONField`), the date it was made (`date_kind`, `date_year`, `date_day`, `date_circa`, see below), `status` (`published` or `hidden`), `author` (FK User).
  - **Date:** `date_kind` is `unknown`, `year`, or `day`. Years before the common era are negative (`-500` is 500 BC) and there is no year 0; `date_circa` marks an approximate year ("c. 1850"). An exact day also keeps its year, so crafts can be compared by year whatever their kind of date. A check constraint keeps the fields consistent with the kind.
  - Hidden lookup items cannot be chosen for a craft, but crafts that already use them keep showing them.
  - Crafts added before these fields existed were converted by a migration: the craft type text was matched to a craft type in the same category (or added as one), the region became the address and country and set the culture, the four texts were joined into `description` under their old labels, and the material names became material entries. A later migration moved the "How to understand it" and "Cultural relevance" sections out of `description` into `story`.
- **CraftPlace**: `craft` (FK), `address`, `city`, `country`, `latitude`, `longitude`, `is_origin`, and `order`. A craft has 1 to 10 places, each listed once. The author can mark one place as the origin (at most one per craft, enforced by a partial unique constraint), or leave all places equal. The API writes a craft's places as a `places` list, and the services copy the main place (the origin, or the first place when all are equal) onto the craft's own location fields, so lists, cards, and profiles need no join. A migration gave each existing craft its location as its only place.
- **CraftColor**: `craft` (FK), `value` (`#rrggbb`, or `#rrggbbaa` when see-through), `main_color`, and `order`. `main_color` is one of 12 names (red, orange, yellow, green, turquoise, blue, purple, pink, brown, black, white, grey), worked out from the value by `crafts.colors` when the color is saved, and is what the main color filter matches. The API reads and writes a craft's colors as a list of these values, e.g. `["#1e40af", "#40e0d080"]`. A craft has up to 10 colors, each listed once. The frontend accepts hex, `rgb()`, `hsl()`, and CSS color names and sends the hex form, which the backend checks.
- **CraftMedia**: `craft` (FK), `media_type` (`photo`, `video`, `document`), `file` or `url`, `caption`, `alt_text`, `order`.
- **CraftStory**: `craft` (FK), `author` (FK User), `text` (up to 5,000 characters), `status` (`published` or `hidden`). A registered user's own story about a craft: what it means to them, how it is made where they live, or its history. One story per user per craft (unique constraint). The craft's author tells their story in the craft's own `story` field, so they cannot add one here. Writing a story needs a verified email. The writer and admins can edit or delete it; admins hide or remove it through story reports.

`attributes` stores craft-specific properties that vary between crafts, for example:

```json
{
  "dimensions": [
    { "type": "height", "value": 20, "unit": "cm" },
    { "type": "width", "value": 20, "unit": "cm" },
    { "type": "weight", "value": 450, "unit": "g" }
  ],
  "distinguishing_features": "Hand-painted floral motifs under a transparent glaze"
}
```

Dimensions are optional rows, each type entered once. The unit must suit the type:

| Types                                                                          | Units                       |
| ------------------------------------------------------------------------------ | --------------------------- |
| `height`, `width`, `depth`, `length`, `diameter`, `circumference`, `thickness` | `mm`, `cm`, `m`, `in`, `ft` |
| `weight`                                                                       | `g`, `kg`, `oz`, `lb`       |
| `volume`                                                                       | `ml`, `l`, `fl oz`          |

Values are kept in the unit the author entered. Weight used to be a separate `weight_g` attribute; a migration turned it into a weight row in grams.

### moderation

- **Report**: `craft` (FK), `reporter` (FK User), `reason` (`inaccurate`, `inappropriate`, `disrespectful`), `note`, `status` (`open`, `resolved`, `dismissed`). One open report per user per craft, enforced by a partial unique constraint on (`craft`, `reporter`) where `status = open`, so a user can report the same craft again after the earlier report is closed.
- **ReviewAction**: `report` (FK), `admin` (FK User), `action` (`edit`, `hide`, `remove`, `dismiss`), `reason`.
- **ItemReport**: a report on a lookup item added by a user. `item_type` (`category`, `craft_type`, `tool`, `material`, `culture`), `item_id`, `item_name` (kept so the report still reads well after a rename or merge), `reporter` (FK User), `reason` (`duplicate`, `inaccurate`, `inappropriate`), `note`, `status`. One open report per user per item, enforced the same way as for crafts.
- **ItemReviewAction**: `report` (FK ItemReport), `admin` (FK User), `action` (`edit`, `hide`, `merge`, `dismiss`), `reason`, `details` (the new name or description, or the item merged into).
- **StoryReport**: `story` (FK CraftStory), `reporter` (FK User), `reason` (the same reasons as a craft report), `note`, `status`. One open report per user per story, enforced the same way as for crafts.
- **StoryReviewAction**: `report` (FK StoryReport), `admin` (FK User), `action` (`hide`, `remove`, `dismiss`), `reason`.

### social

- **Favorite**: `user` (FK), `craft` (FK). Unique on (`user`, `craft`). The row is hard-deleted on unfavorite.
- **Follow**: `follower` (FK User), `following` (FK User). Unique on the pair; a check constraint blocks following yourself. The row is hard-deleted on unfollow.

### notifications

- **Notification**: `recipient` (FK User), `type` (`new_craft_from_followed`, `favorite_updated`, `report_resolved`, `new_story`), `craft` (FK, nullable), `actor` (FK User, nullable), `data` (`JSONField` with extra context, for example the review action and report status for `report_resolved`), `is_read`.

### Indexes

- `Craft(category)`, `Craft(craft_type)`, `Craft(culture)`, and `CraftPlace(latitude, longitude)` for map and filter queries.
- `CraftColor(main_color)` for the main color filter.
- `CraftStory(craft, status, is_deleted)` for listing a craft's stories.
- `Notification(recipient, is_read)` for the unread count.
- `Report(status)` for the admin queue.

### Soft Delete and Visibility

Only craft content is soft-deleted, because it is the content that moderation removes and that may need to be reviewed or restored.

- **Soft-deleted models:** `Craft`, `CraftMedia`, and `CraftStory`. Calling `delete()` on an instance or on a QuerySet sets `is_deleted` instead of removing the row. The default manager excludes deleted rows, and a second manager (`all_objects`) returns every row for the Django admin and audit use.
- **Everything else:** `Favorite` and `Follow` rows are hard-deleted, so their unique constraints never block favoriting or following again. `Report`, `ReviewAction`, and `Notification` rows are kept. Accounts are deactivated with `is_active` rather than deleted, so the unique `email` is never left behind on a deleted row.
- **Limit of the manager filter:** the default manager only filters queries that start from `Craft`. A query that reaches a craft through a foreign key (a favorite, a notification, a report) still sees deleted and hidden crafts.

Because of that limit, craft visibility is defined once and reused:

- `crafts.selectors.visible_crafts(viewer)` returns the crafts a viewer may see: not deleted, and either `published` or owned by the viewer. Admins also see hidden crafts.
- Every public craft query starts from this selector.
- Selectors in other modules restrict by it instead of repeating the conditions. For example, `/me/favorites/` lists favorites where `craft__in=visible_crafts(viewer)`.
- A notification is kept when its craft is hidden or removed, but its `craft` is returned as `null` if the recipient can no longer see it.
- Stories follow the same idea: a craft's story list shows only published stories, a story can be reported only if it is published and its craft is visible to the reporter, and a hidden story is found only by its writer and admins.

---

## API Design

All endpoints are under `/api/v1/`. List endpoints are paginated, except the reference and lookup lists, which return every visible row so the frontend can fill its pickers and filters in one request. `/craft-types/` accepts a `category` id, and `/tools/` and `/materials/` a `craft_type` id that marks the typical items with `typical: true` and lists them first.

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
| GET    | `/health/`                             | Public          | Answers when the app and the database are up (used by the host) |
| GET    | `/crafts/`                             | Public          | List crafts (filter by category, craft type, culture, country, main color, area, search) |
| GET    | `/crafts/map/`                         | Public          | Lightweight pins for the map, one per place of each craft (same filters, plus `bbox=west,south,east,north`) |
| GET    | `/crafts/facets/`                      | Public          | For each filter, the values the other filters' results have, with counts |
| GET    | `/geocode/search/?q=`                  | Registered user | Coordinates, address, city, and country for an address (404 if not found) |
| GET    | `/geocode/reverse/?lat=&lng=`          | Registered user | Address at a point, for a pin placed on the map (404 if none) |
| GET    | `/crafts/{id}/`                        | Public          | Craft details                         |
| POST   | `/crafts/`                             | Registered user | Publish a craft                       |
| PATCH  | `/crafts/{id}/`                        | Author or admin | Edit a craft                          |
| DELETE | `/crafts/{id}/`                        | Author or admin | Soft delete a craft                   |
| POST   | `/crafts/{id}/media/`                  | Author          | Upload photo, video, or document      |
| DELETE | `/crafts/{id}/media/{media_id}/`       | Author or admin | Remove a media item                   |
| GET    | `/crafts/{id}/stories/`                | Public          | A craft's published stories, oldest first (`author` to find one user's story) |
| POST   | `/crafts/{id}/stories/`                | Registered user | Share your story about the craft (not its author) |
| PATCH  | `/crafts/{id}/stories/{story_id}/`     | Writer or admin | Edit a story                          |
| DELETE | `/crafts/{id}/stories/{story_id}/`     | Writer or admin | Soft delete a story                   |
| GET    | `/categories/`, `/craft-types/`, `/tools/`, `/materials/`, `/cultures/` | Public | Lookup lists for the craft form and filters |
| POST   | `/categories/`, `/craft-types/`, `/tools/`, `/materials/`, `/cultures/` | Registered user | Add a lookup item (201), or get the existing one with the same name (200) |
| POST   | `/crafts/{id}/report/`                 | Registered user | Report a craft                        |
| GET    | `/moderation/reports/`                 | Admin           | Review queue (`status=open` by default; also `resolved`, `dismissed`, `all`) |
| GET    | `/moderation/reports/{id}/`            | Admin           | Report details with its review history |
| POST   | `/moderation/reports/{id}/actions/`    | Admin           | Edit, hide, remove, or dismiss        |
| POST   | `/{categories,craft-types,tools,materials,cultures}/{id}/report/` | Registered user | Report a lookup item added by another user |
| GET    | `/moderation/item-reports/`            | Admin           | Item review queue, with the item, who added it, and how many crafts use it |
| GET    | `/moderation/item-reports/{id}/`       | Admin           | Item report details with its review history |
| POST   | `/moderation/item-reports/{id}/actions/` | Admin         | Edit, hide, merge, or dismiss         |
| POST   | `/stories/{id}/report/`                | Registered user | Report another user's story           |
| GET    | `/moderation/story-reports/`           | Admin           | Story review queue (same `status` filter as crafts) |
| GET    | `/moderation/story-reports/{id}/`      | Admin           | Story report details with its review history |
| POST   | `/moderation/story-reports/{id}/actions/` | Admin        | Hide, remove, or dismiss              |
| GET    | `/crafts/{id}/favorite/`               | Public          | Favorite status and count             |
| POST   | `/crafts/{id}/favorite/`               | Registered user | Favorite (DELETE to unfavorite)       |
| GET    | `/me/favorites/`                       | Registered user | List own favorites                    |
| GET    | `/me/following/`, `/me/followers/`     | Registered user | The users you follow, and who follows you |
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

### Search and Facets

- **Search** splits the text into words (up to 6), and every word must start a word in one of the craft's name, description, story, craft type, category, culture, distinguishing features, tools, materials, or the address, city, or country of any of its places. So "tile" finds tiles but not textiles, and "kilim mexico" finds Mexican kilims. Matching uses PostgreSQL's word-start regular expression (`\m`), with the user's text escaped. Tools, materials, and places are matched with `EXISTS` subqueries, so a craft is listed once however many of them match. The country filter matches a craft with a place in that country.
- **Main color** (`color`) matches a craft with any color whose `main_color` is the chosen one.
- **Area** (`area=west,south,east,north`) matches a craft with a place inside the box, which may cross the 180th meridian. The frontend's "search near a place" looks the place up and sends its area.
- **Facets** (`/crafts/facets/`) take the same filters and return, for each of category, craft type, culture, country, and main color, the values found with a count of crafts. A craft counts once in each country it has a place in. Each list leaves out its own filter, so the other countries stay available after picking one, while the other lists narrow to that country.

### Address Lookup

The craft form finds coordinates for an address, and the address for a pin placed on the map, through `/geocode/`. The backend calls OpenStreetMap Nominatim (`crafts.geocoding`) instead of the browser, so its usage policy holds for the whole application and the frontend's Content Security Policy does not need another origin:

- Every request sends an identifying `User-Agent` (`GEOCODER_USER_AGENT`).
- At most one request per second goes out across all Gunicorn workers: a one-second slot is taken in the shared cache, and a request that cannot get one within 3 seconds returns 503.
- Results are cached for a day, and "not found" for an hour, so repeated lookups do not reach Nominatim.
- If Nominatim cannot be reached the endpoints return 503, and the user can still place the pin on the map by hand.

### Throttling

DRF throttle classes limit request rates. Anonymous and authenticated clients have default rates, and stricter scoped rates apply to the endpoints most open to abuse: registration, login, token refresh, resending the verification email, password reset, reporting a craft, adding lookup items, and address lookups.

Throttle counters are stored in Django's database cache, so the limits hold across Gunicorn workers without adding another service.

---

## Authentication and Authorization

### Authentication

- Users register with email and password. A verification email is sent, and the account can publish only after verification.
- While no mail provider is configured, `AUTO_VERIFY_EMAIL=true` marks new accounts as verified on registration and skips the verification email. It is on in local Docker Compose and development settings, off by default in production, and should be turned off once email delivery works.
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
| Share, edit, delete own stories     |       |       Yes       |  Yes  |
| Add items to the shared lists       |       |       Yes       |  Yes  |
| Favorite, follow, report            |       |       Yes       |  Yes  |
| Edit own profile and privacy        |       |       Yes       |  Yes  |
| Review reports; hide or remove any craft or story; edit, hide, or merge list items |  |  |  Yes  |

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

### Reports on Lookup Items

Users can add categories, craft types, tools, materials, and cultures that everyone can use right away, so these items can be reported too. Only items added by users can be reported, and not by the user who added them.

- `edit` takes a new `name`, a new `description`, or both, with the same rules as adding an item. A name that already exists returns `409 Conflict`, pointing the admin to merge instead. Admins edit seeded items, which cannot be reported, in Django admin.
- `hide` removes the item from the lists. Crafts that already use it keep showing it.
- `merge` takes `merge_into`, another visible item of the same kind (for craft types, of the same category). Every craft that used the item uses the target instead, a tool or material's typical craft types move over, and the item is deleted. Merging a category moves its craft types, and merges any with the same name in the target category.
- `dismiss` leaves the item unchanged.
- As with crafts, `hide` and `merge` close every other open report on the item, a report can be reviewed once, and every action is stored with the admin, reason, and what changed. The lookup changes themselves are done by `crafts.services`, which checks the admin role again.

### Reports on Stories

Users can report another user's published story, with the same reasons as a craft. A user cannot report their own story, and has at most one open report per story.

- `hide` sets the story's status to `hidden`; its writer and admins can still find it.
- `remove` soft deletes the story.
- `dismiss` leaves it unchanged.
- `hide` and `remove` close every other open report on the story. A report can be reviewed once, every action is stored as a `StoryReviewAction`, and the reporter is notified. The story changes are done by `crafts.services.hide_story` and `remove_story`.

---

## Notifications

Notifications are created synchronously, within the same database transaction as the change that triggers them. The triggering service sends a Django signal and `notifications.receivers` creates the rows, so `crafts` and `moderation` do not depend on `notifications` (see [Module Boundaries](#module-boundaries)).

| Event                        | Signal (sent by)                                          | Recipients             |
| ---------------------------- | --------------------------------------------------------- | ---------------------- |
| User publishes a craft       | `craft_published` (`crafts.services.publish_craft`)       | Followers              |
| A favorited craft is updated | `craft_updated` (`crafts.services.update_craft`)          | Users who favorited it |
| A report is resolved         | `report_resolved` (`moderation.services.review_report`)   | The reporter           |
| A story report is resolved   | `story_report_resolved` (`moderation.services.review_story_report`) | The reporter (type `report_resolved`) |
| A user shares a story        | `story_shared` (`crafts.services.share_story`)            | The craft's author (type `new_story`) |

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

## Logging and Monitoring

- **Request logs:** `core.middleware.RequestLogMiddleware` logs every API request as one line: method, path, query, status, time taken in milliseconds, the signed-in user, client address, user agent, request and response sizes, and both bodies.
- **Masking:** any field whose name contains `password`, `token`, `secret`, `refresh`, `access`, or `authorization` is replaced by `***`. Uploaded files are logged by name and size only, and bodies are cut at `REQUEST_LOG_BODY_LIMIT` characters (2000 by default).
- **Request ID:** each request gets an ID, taken from a valid incoming `X-Request-ID` header or generated, and returned in the response's `X-Request-ID` header, so a user's error report can be matched to its log line.
- **Skipped paths:** `REQUEST_LOG_SKIP_PATHS` leaves out the health check, which the host calls regularly.
- **Format:** `core.logs.JsonFormatter` writes one JSON object per line in production (`LOG_FORMAT=json`); development uses plain text. Gunicorn's own access log is off, so each request is logged once.
- **Monitoring:** Render streams the logs to Better Stack, where they can be searched by field, for example `status >= 500` or `duration_ms > 1000`.

---

## Testing Strategy

| Level       | What is tested                                          | Tools                     |
| ----------- | ------------------------------------------------------- | ------------------------- |
| Unit        | Services and selectors: business rules, permissions     | pytest, factory_boy       |
| API         | Endpoints: status codes, permissions, privacy filtering | DRF `APIClient`           |
| Integration | Full flows, e.g., publish, report, admin hide           | pytest with a test database |

The backend has 444 tests (`pytest` in `backend/`). They run against PostgreSQL (not SQLite) so constraints and `JSONField` behave as in production. Privacy rules (FR-17, FR-18), role permissions, and visibility of hidden and removed crafts and stories have dedicated tests. In addition:

- **Query counts:** the list, map, detail, and story endpoints have tests that keep the number of database queries fixed, so a missing `select_related` fails the build.
- **Migrations:** data migrations are tested against records in their old shape.
- **No external services:** the address lookup is replaced by a stand-in, so tests never call Nominatim.
- **Static checks:** ruff (lint and format) and import-linter (module boundaries) run with the tests in CI.

---

## Configuration

Settings are split into `base`, `development`, `production`, and `test`. Values come from environment variables through `django-environ`.

```env
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=change-me
DJANGO_ALLOWED_HOSTS=api.example.com
CSRF_TRUSTED_ORIGINS=https://api.example.com
DATABASE_URL=postgres://user:password@db:5432/indigenous_crafts
JWT_SIGNING_KEY=change-me
CORS_ALLOWED_ORIGINS=https://example.com
FRONTEND_URL=https://example.com
SERVE_MEDIA=true
AUTO_VERIFY_EMAIL=false
GEOCODER_URL=https://nominatim.openstreetmap.org
GEOCODER_USER_AGENT=IndigenousCrafts/1.0 (+https://example.com)
LOAD_SAMPLE_DATA=false
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=change-me
EMAIL_HOST_PASSWORD=change-me
DEFAULT_FROM_EMAIL=Indigenous Crafts <no-reply@example.com>
GUNICORN_WORKERS=3
LOG_LEVEL=INFO
LOG_FORMAT=json
REQUEST_LOG_BODY_LIMIT=2000
```

`SERVE_MEDIA` lets Django serve uploaded files when no separate file server or object storage is used, as on the current host. `DJANGO_SECURE_COOKIES` (default `true` in production) can be turned off for a local stack without HTTPS.

Secrets are never committed. A `.env.example` file documents the variables, and the deployed values are kept in Render only.

---

## Deployment

The application runs as a single instance.

- **Local development:** Docker Compose starts three containers: `db` (PostgreSQL 16), `backend`, and `frontend`. Compose sets `AUTO_VERIFY_EMAIL`, `SERVE_MEDIA`, and `LOAD_SAMPLE_DATA` so the stack works without email or object storage.
- **Hosting:** Render runs the backend as a Docker web service built from `backend/Dockerfile`, with a Render PostgreSQL database. Its health check calls `/api/v1/health/`, which answers when the app and the database are up.
- **Pipeline:** GitHub Actions runs the backend, frontend, and end-to-end tests on every pull request. On `main`, once all of them pass, it calls Render's deploy hooks; Render's own auto-deploy is off, so a failing build never goes live. `main` is protected: changes arrive only through pull requests with these checks passing.
- **Image:** multi-stage Docker build. The runtime stage uses a slim Python image, runs as a non-root user, and contains no build tools.
- **Startup:** the entrypoint runs `python manage.py migrate --noinput`, then `createcachetable`, then `collectstatic`, then `load_sample_crafts` when `LOAD_SAMPLE_DATA=true`, and starts Gunicorn with `GUNICORN_WORKERS` workers (2 on the free plan). With one instance there is no risk of concurrent migrations.
- **Sample data:** `python manage.py load_sample_crafts` adds 35 real crafts at their real towns, with freely licensed photos from Wikimedia Commons, owned by sample contributor accounts that cannot log in. Running it again adds nothing, but puts back any photo files missing from storage, which the free plan's disk loses on every redeploy. `--remove` takes the crafts, their photo files, and the contributors out again. The data and photos live in `crafts/sample_data/`, with every photo credited in its caption and in `CREDITS.md`. Docker Compose and the current deployment both set `LOAD_SAMPLE_DATA=true`.
- **Free plan limits:** the service sleeps after 15 minutes without traffic (the next request takes about a minute), the disk is not persistent (uploaded files are lost on redeploy), and the free database expires after 30 days unless upgraded.
- **Admin account:** created once with `python manage.py createsuperuser`, then given the `admin` role.
- **Maintenance:** `python manage.py flushexpiredtokens` should run daily (host cron or the platform's scheduler) to clear expired entries from the token blacklist.

---

## Future Extensions

- **AI assistance layer (FR-20):** an `ai` app that suggests descriptions and categories and flags possible issues for admin review. It would be called from `crafts.services` behind an interface, so it can be added or disabled without changing other modules.
- **Background tasks:** add a task queue if email sending, image resizing, or follower notifications slow down requests.
- **Geospatial queries:** switch latitude and longitude to PostGIS if the map needs radius or bounding-box search at scale.
