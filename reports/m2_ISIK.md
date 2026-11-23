# SWE573 Milestone 2 (MVP) Report: Indigenous Crafts

**Olcay Işık** · SWE573 Software Development Practice, Boğaziçi University · 23 November 2026

Indigenous Crafts is an interactive world map of handmade crafts and the cultures that make them. Guests explore crafts on the map and in a list, with search and filters; registered users publish crafts with places, photos, videos, documents, tools, materials, colors, dimensions, and dates, share their own stories about crafts, favorite crafts, follow contributors, and report problem content; admins review reports.

## Submission links

| Item | Link |
|---|---|
| Repository | https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice |
| Deployment | https://indigenous-crafts-swe.onrender.com |
| API documentation | Swagger UI: https://indigenous-crafts-api.onrender.com/api/docs/ · OpenAPI schema in the repository: [docs/openapi.yaml](../docs/openapi.yaml) |
| Pre-release | [0.2.0-beta, tag milestone-2](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/releases/tag/milestone-2) |
| Demo video | To be added |
| Test credentials | Registered user: `tester@example.com` / `Kilim-Tester-2026!` · Admin account: given in the Moodle submission, not in the public repository |

**To try the deployed system:** the free host sleeps after 15 minutes without visitors, so the first page can take about a minute. Anyone can also register a new account; until an email service is set up, new accounts are verified automatically.

## Core workflow

1. Open the map, search for *kilim*, filter by a country or a main color, and open a craft's page.
2. Log in as the test user (or register), choose **Add a craft**, and publish a craft with a place, a photo, and its details; it appears on the map at once.
3. On another user's craft, choose **Share your story**, favorite the craft, and follow its author.
4. Report a craft or a story; as admin, open **Review reports** and hide or dismiss it with a reason. The reporter is notified.

## Deliverables

Everything is in the repository or its [wiki](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki); external links are supplementary. Diagrams are kept in the wiki ([Architecture](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Architecture), [Deployment and Operations](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Deployment-and-Operations)) and in the design documents, and are linked, not embedded.

| Deliverable | Where |
|---|---|
| Working, deployed, dockerized MVP | The repository; `docker compose up --build`; the deployment above |
| Updated SRS with a changelog against Milestone 1 | [docs/Indigenous_Crafts_SRS_v1.0.pdf](../docs/Indigenous_Crafts_SRS_v1.0.pdf), section 1 |
| Updated design documents | [Backend](../docs/Indigenous_Crafts_Backend_Architecture_v1.0.pdf) and [frontend](../docs/Indigenous_Crafts_Frontend_Architecture_v1.0.pdf) architecture v1.0 (sources: [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md), [FRONTEND_ARCHITECTURE.md](../FRONTEND_ARCHITECTURE.md)); [use cases and user stories](../docs/Indigenous_Crafts_Use_Cases_and_User_Stories_v0.1.pdf) |
| Requirement status table | Wiki: [Requirement Status](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Requirement-Status), with links to the code, tests, and deployed feature of every requirement |
| API documentation | Swagger UI and [docs/openapi.yaml](../docs/openapi.yaml): every endpoint, with example requests and responses for eight endpoints (log in, crafts list, details, publish, profile, story, report, admin review); the examples are tested against the API |
| Test plan and results, unit and user tests, verbose output | [Test Plan and Results v2.0](../docs/Indigenous_Crafts_Test_Plan_and_Results_v2.0.pdf); verbose output in [docs/test-results/](../docs/test-results/) |
| Installation instructions with Docker and system requirements | Wiki: [Installation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Installation), tested from a fresh clone; deployment steps and environment variables in the [user and technical documentation](../docs/Indigenous_Crafts_User_and_Technical_Documentation_v2.0.pdf), sections 12 to 17 |
| Milestone review | Submitted separately; [reports/m2_review_ISIK.md](m2_review_ISIK.md) and the wiki page [Milestone Review](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Milestone-Review) |
| Individual contributions | Below |
| Demo video | Above |
| AI usage | [AI_USAGE.md](../AI_USAGE.md); summary below |
| Elicitation and project board | Wiki: [Requirements Elicitation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Requirements-Elicitation); board export [docs/project-board.csv](../docs/project-board.csv) |

## Requirements status

Of 30 functional requirements, 27 are completed (documented, tested, and deployed), 1 is partial, and 2 are not started; of 12 non-functional requirements, 11 are completed and 1 is partial. The details and links are on the [Requirement Status](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Requirement-Status) page.

- **Partial:** FR-02, because the deployment has no email service, so it verifies new accounts automatically and sends no verification or reset emails (both flows are tested); NFR-01, because the user tests did not time how long it takes to find a first craft.
- **Not started:** FR-20, the optional AI assistance layer (deferred); FR-30, the living or endangered status of a craft (Won't in this release).

## Testing

725 automated tests pass: 462 backend (pytest against PostgreSQL), 252 frontend (Vitest with Testing Library and axe), and 11 end-to-end (Playwright against the Docker stack, desktop and phone). Coverage is 96.5% of backend statements and 93.7% of frontend lines. In the user tests, three participants used the live site on their own and all completed the four core tasks. Every pull request runs all suites, and only a passing main branch is deployed.

## AI usage summary

I used one AI tool since Milestone 1, Claude Code (Anthropic's Claude, working in the repository from VS Code), for code generation, document generation, and report generation. **Not all of the code was generated with AI:** code is mixed by area, and overall I wrote about 60% of the application code myself, while about 40% was drafted with AI from tasks I specified. Documents and reports were drafted with AI from the code, the tests, and the issue history, then reviewed, corrected, and approved by me. In every case I set the task, its details, and its limits, made the decisions, and checked the output: every change went through a pull request that I reviewed and that had to pass the automated tests, and documents were checked against the code, the tests, and the live site. These checks caught several AI mistakes, listed in [AI_USAGE.md](../AI_USAGE.md). The interviews, the questionnaire, the user tests, and all decisions on scope and priorities were done by me without AI; before Milestone 1, the research for the document analysis also used Claude, ChatGPT, and Gemini, cross-checked against each other.

## Individual Contributions

### Olcay Işık

**Member:** Olcay Işık ([OlcayISIK](https://github.com/OlcayISIK)). This is an individual project; all 79 issues are assigned to me, and all 70 merged pull requests are mine.

**Responsibilities:** everything: requirements elicitation and specification, design, backend, frontend, testing, deployment, documentation, and project management.

**Main contributions:**

- Requirements: the elicitation (issues [#4](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/4) to [#7](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/7)), the SRS draft and v1.0 with its changelog ([#8](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/8), PR [#147](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/147)), use cases and user stories ([#9](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/9)).
- Design: backend and frontend architecture ([#10](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/10), PRs [#32](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/32), [#33](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/33), [#148](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/148)).
- Backend (Django REST API): accounts with JWT and email verification, crafts with places, colors, dates, media, and shared lists, search with filter counts, address lookup, reports and admin review, favorites, follows, notifications, stories, request logging (PRs [#45](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/45) to [#58](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/58), [#92](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/92) to [#95](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/95), [#142](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/142), [#144](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/144)).
- Frontend (React): token refresh, the clustered map with a list view, filters, craft pages, the structured craft form, admin queues, notifications, stories, and the redesign (PRs [#70](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/70) to [#84](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/84), [#96](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/96), [#97](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/97), [#123](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/123), [#143](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/143)).
- Testing and operations: the three test suites, verbose CI reports, the CI/CD pipeline with deployment to Render, Docker, and the user tests (PRs [#81](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/81), [#132](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/132), [#150](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/150), [#151](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/151), [#155](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/155)).
- Documentation: the wiki, the API examples, the installation instructions, the user and technical documentation ([#16](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/16), PRs [#156](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/156), [#157](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/157)).

**API contributions:** `GET /api/v1/crafts/`, the craft search with filters, which I developed (back-end) and use (front-end). It combines a word-start text search over the craft's fields, tools, materials, and places with filters by category, craft type, culture, country, main color, and area; it returns only crafts the viewer may see, in pages.

Example call:

```
GET https://indigenous-crafts-api.onrender.com/api/v1/crafts/?search=kilim&country=Türkiye&pageSize=1
```

Response (from the deployment; nested category, craft type, and culture shortened to id and name):

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 36,
        "name": "Denizli Kilimi",
        "category": { "id": 2, "name": "Textiles" },
        "craft_type": { "id": 7, "name": "Kilim" },
        "culture": { "id": 25, "name": "Turkish" },
        "city": "Denizli",
        "country": "Türkiye",
        "latitude": 37.826949,
        "longitude": 29.238424,
        "cover_photo": null,
        "status": "published",
        "author": { "id": 7, "display_name": "Olcay" },
        "created_at": "2026-10-27T16:44:25.898917Z"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 1,
    "totalPages": 3
  },
  "message": "OK"
}
```

Context: the Crafts list page and the map's list view call it from the filter bar, which keeps the filters in the page address ([useCraftFilters.ts](../frontend/src/features/crafts/hooks/useCraftFilters.ts), [api.ts](../frontend/src/features/crafts/api.ts)). On the server, the view validates the filters and [selectors.py](../backend/crafts/selectors.py) builds the query (`browse_crafts`, `_apply_filters`, `_matches`). It was built in PRs [#51](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/51) and [#114](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/114), and later extended with main colors ([#129](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/129)) and areas ([#131](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/131)).

**Code-related significant issues:**

| Issue | Pull request | Commits | Contribution |
|---|---|---|---|
| [#38 Craft entries](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/38) | [#50](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/50) | [5c96310](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/5c96310), merge [f3a4b00](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/f3a4b00) | The core data model and publishing without approval |
| [#39 Craft browsing, filters, and map pins](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/39) | [#51](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/51) | [a8e748c](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/a8e748c), merge [fd5766a](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/fd5766a) | The crafts list, filters, and lightweight map pins |
| [#60 API client and token refresh](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/60) | [#71](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/71) | [e784705](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/e784705), merge [3299cb6](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/3299cb6) | Single-flight token refresh, so parallel requests never log the user out |
| [#62 Map and craft browsing](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/62) | [#74](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/74) | [dde9667](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/dde9667), merge [f90cd50](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/f90cd50) | The clustered world map and its accessible list view |
| [#87 Structured craft fields](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/87) | [#93](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/93) | [7ea2dd4](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/7ea2dd4), merge [497346a](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/497346a) | Shared lists instead of free text, with a tested data migration |
| [#88 Address lookup](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/88) | [#94](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/94) | [7f2a91c](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/7f2a91c), merge [d6ada2c](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/d6ada2c) | Server-side, rate-limited, cached use of OpenStreetMap Nominatim |
| [#107 Search and filters](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/107) | [#114](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/114) | [4ad44e7](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/4ad44e7), merge [8c1bba9](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/8c1bba9) | Word-start search and filter lists with counts |
| [#111 Crafts in several places](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/111) | [#118](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/118) | [11c8661](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/11c8661), merge [a7fddf6](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/a7fddf6) | One pin per place, with an optional origin |
| [#121 Redesign the interface](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/121) | [#123](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/123) | [f88d9ca](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/f88d9ca), merge [1e8c703](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/1e8c703) | The visual design, with WCAG AA contrast and reduced motion |
| [#133 Log every API request](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/133) | [#134](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/134) | [dca91f7](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/dca91f7), merge [a450dfa](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/a450dfa) | Structured, masked request logs for the deployed system |
| [#139](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/139) to [#141 Stories](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/141) | [#142](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/142) to [#144](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/144) | [af55fa0](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/af55fa0), [9813813](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/9813813), [71053b1](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/commit/71053b1) | Community stories with their own moderation |

**Non-code-related significant issues:**

| Issue | Explanation |
|---|---|
| [#4](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/4), [#5](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/5), [#6](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/6) Elicitation | Interviews, a questionnaire, and a document analysis of UNESCO's and the V&A's records; the findings are on the wiki page Requirements Elicitation |
| [#7 Project proposal](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/7) | Problem, users, and scope |
| [#8 Requirements specification](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/8) | SRS draft with MoSCoW priorities and traceability, then v1.0 with a changelog |
| [#9 Use cases and user stories](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/9) | Use cases and user stories with acceptance criteria |
| [#10 System architecture](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/10) | Backend and frontend architecture, updated to the code at release |
| [#13](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/13), [#14](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/14) Testing | The test plan, the results with verbose output, and the user tests |
| [#16 Documentation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/16) | User and technical documentation, installation instructions tested from a fresh clone |
| [#17 Report](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/17) | This report, the milestone review, and AI_USAGE.md |

**Pull requests:** I created and merged all 70 pull requests; each feature pull request closes its task issue, and the release documents reference their deliverable issue. As the only member I had no other reviewer, and GitHub does not let an author approve their own pull request; every pull request was reviewed by me before merging and had to pass the backend, frontend, and end-to-end checks that protect the main branch, which also requires a branch to be up to date with main before it merges. There were no merge conflicts to resolve: the history has no conflict-resolution commits. Dependabot opened 9 dependency pull requests; none were merged yet.

**Additional information:** I ran the user tests (three participants on the live site), wrote the wiki (15 pages), and set up the issue template with SLA labels and the workflows that check them. The full figures are on the wiki page [Individual Contributions](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Individual-Contributions).
