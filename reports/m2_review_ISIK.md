# SWE573 Milestone 2 Review: Indigenous Crafts

**Olcay Işık** · 23 November 2026 · Period reviewed: Milestone 1 (4 October 2026) to the MVP release

## 1. Project status

**What works.** The core workflow runs end to end on the deployment (https://indigenous-crafts-swe.onrender.com): exploring crafts on a clustered map and in a list, word-start search with filter counts, search near a place, craft pages with places, media, attributes, and dates; registration and login; publishing and editing crafts; community stories; favorites, follows, and notifications; reporting crafts, list items, and stories, and admin review with history. 725 automated tests pass on every change, and only a passing main branch is deployed.

**What does not work.**

- The deployment has no email service: new accounts are verified automatically, and verification and password-reset emails are not sent (FR-02 is partial).
- Files uploaded on the deployment are lost when the backend redeploys, because the free host has no persistent disk; the sample photos are restored automatically.
- Whether a first-time user finds a craft within 30 seconds (NFR-01) has not been measured.
- Not built: the AI assistance layer (FR-20), the endangered status, audio recordings, and side-by-side comparison (FR-30 to FR-32).

**What changed since Milestone 1.** The requirements grew from 20 to 32 functional and from 8 to 12 non-functional requirements: 16 modified, 16 added, none removed. The data model became structured (shared lists, several places per craft, colors, dates), stories were added, and request logging, a health check, documented API examples, and a CI/CD pipeline were built. Since Milestone 1: 70 merged pull requests, 725 automated tests, and one round of user tests.

## 2. Requirements addressed, with evidence links

Every requirement, with links to its documentation, code, tests, and deployed feature, is on the wiki page [Requirement Status](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Requirement-Status). Completed means documented, tested, and deployed: 27 of 32 functional and 11 of 12 non-functional requirements.

| Area | Requirements | Evidence |
|---|---|---|
| Browsing without an account | FR-01, FR-03 | PR [#51](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/51), [#74](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/74); tests `test_browsing.py`, `browsing.test.tsx` |
| Craft entries, places, attributes, media, dates | FR-04 to FR-09, FR-24 | PR [#50](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/50), [#93](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/93), [#118](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/118), [#130](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/130); tests `test_crafts.py`, `test_places.py`, `test_media.py`, `form.test.tsx` |
| Contribution and moderation | FR-10 to FR-12, FR-28 | PR [#53](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/53), [#54](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/54), [#95](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/95), [#144](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/144); tests `test_review.py`, `test_item_reports.py`, `test_story_reports.py`, end-to-end `moderation.spec.ts` |
| Social features and stories | FR-13 to FR-15, FR-26 | PR [#55](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/55), [#56](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/56), [#142](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/142), [#143](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/143); tests `test_social.py`, `test_notifications.py`, `test_craft_stories.py`, end-to-end `stories.spec.ts` |
| Profiles and privacy | FR-16 to FR-19 | PR [#48](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/48), [#77](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/77); tests `test_profiles.py`, `profiles.test.tsx` |
| Search and exploration | FR-21 to FR-23 | PR [#114](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/114), [#129](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/129), [#131](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/131); tests `test_browsing.py`, `test_area_filter.py`, end-to-end `map-search.spec.ts` |
| Lists, address lookup, drafts | FR-25, FR-27, FR-29 | PR [#92](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/92), [#94](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/94), [#117](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/pull/117); tests `test_lookups.py`, `test_geocoding.py`, `useDraft.test.ts` |
| Quality requirements | NFR-02 to NFR-12 | Query-count, accessibility (axe), mobile end-to-end, security, logging, and deployment tests; see the Requirement Status page |

## 3. Requirements deferred or dropped, with justification

| Requirement | Decision | Justification |
|---|---|---|
| FR-20 AI assistance layer | Deferred | Optional in the SRS draft and not needed for the core workflow; specified separately in issue [#24](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues/24) for a later version |
| FR-30 Living or endangered status | Won't in this release | Ranked third in the questionnaire, but a reliable status needs authoritative sources such as UNESCO's lists and curator review, not a value any contributor can set; it is the first item of future work |
| FR-31 Audio recordings | Won't in this release | Ranked last of the features in the questionnaire (issue #5), and not needed for the core workflow |
| FR-32 Side-by-side comparison | Won't in this release | A "nice to have" in the interviews; shared lists and filters already show the same technique or material across cultures |
| FR-02 email part | Partial | Implemented and tested; the deployment has no email provider yet |
| NFR-01 30-second target | Partial | The user tests showed the task is completed without help, but did not time it |

No requirement was removed. The full changelog is in [SRS v1.0](../docs/Indigenous_Crafts_SRS_v1.0.pdf), section 1.

## 4. Design changes and the reasoning behind them

| Change | Reasoning |
|---|---|
| One region and one free-text description became structured fields: category, craft type, culture, tools, materials, and 1 to 10 places with an optional origin | Many crafts are made in several places, and free text cannot be filtered; museum records (UNESCO, V&A) use structured fields |
| Shared lists that users can extend, with descriptions, and admin merging | Seeded lists cannot be complete, and shared items let filters show the same technique across cultures |
| Description and story split; community stories with their own moderation | Facts and interpretation were mixed in one text; interviewees asked for real cultural context, and one author's text is only one voice |
| Address lookup moved to the server, rate limited and cached | Follows the OpenStreetMap usage policy and keeps the browser free of third-party calls |
| Request logging, a health check, and deployment gated by CI | The hosted system must be diagnosable, and a failing build must never go live |
| Documented API examples, tested against the API | Keeps the API documentation true as the code changes |

The architecture itself held: a React single-page application, a Django REST API split into apps whose boundaries are enforced in CI, and PostgreSQL. The design documents v1.0 describe the current system.

## 5. Test coverage: what is tested, what is not, and why

**Tested.** 725 automated tests: 462 backend tests through the API against PostgreSQL, 252 frontend tests of pages and components with accessibility checks, and 11 end-to-end journeys in a real browser against the production build in Docker, on desktop and phone. Coverage is 96.5% of backend statements and 93.7% of frontend lines. The API examples, data migrations, query counts, permissions, privacy rules, and request logging have their own tests. Three participants ran the core tasks in the user tests. Results and verbose output: [Test Plan and Results v2.0](../docs/Indigenous_Crafts_Test_Plan_and_Results_v2.0.pdf), [docs/test-results/](../docs/test-results/).

**Not tested, and why.**

| Not tested | Why |
|---|---|
| Real email delivery | No email provider is configured; emails are checked with Django's test outbox instead |
| The live OpenStreetMap service | Tests must not depend on an outside service or break its usage policy; a stand-in records the requests |
| The development and production settings files | Tests run with the test settings; production settings are exercised by every deployment |
| The real Leaflet location picker in component tests | The test browser (jsdom) cannot lay out a map; a stand-in is used, and the map itself is tested with a real Leaflet map and end to end |
| The error page and parts of the full-screen photo viewer | Rare paths with low risk; they are the main gaps in frontend coverage |
| Browsers other than Chromium; load at production scale | Out of scope for the course; query counts are tested instead of load |
| Time to find a first craft (NFR-01) | The user tests were unmoderated and not timed; a timed session is planned |

## 6. Deployment status

| Item | Status |
|---|---|
| Site | https://indigenous-crafts-swe.onrender.com |
| API and documentation | https://indigenous-crafts-api.onrender.com/api/docs/ |
| Dockerized | Yes: `backend/Dockerfile`, `frontend/Dockerfile`, and `docker-compose.yml` for the whole stack; the end-to-end tests run against it in CI |
| Hosting | Render: Docker web service, static site, and PostgreSQL; deployed by the CI pipeline only after all tests pass on main |
| Installation | Wiki page [Installation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Installation), tested from a fresh clone |

**Known issues.** The free host sleeps after 15 minutes without visitors, so the first page takes about a minute. Uploads are lost on redeploy. The free database expires after a set period. There is no email service. The GitHub project board is private; its export is in [docs/project-board.csv](../docs/project-board.csv).

## 7. Reflection: what the build taught me that the plan did not anticipate

- **The data model in the plan was too coarse.** Only using the running system with real sample crafts showed that crafts are made in several places and that free text cannot be filtered. The model changed several times (structured fields, description and story, dimensions, places, colors, dates), and each change needed a tested data migration.
- **Documents drift unless they are checked against the system.** Checking the design documents against the code, the installation steps against a fresh clone, and the API examples against the API found errors in all three. The API examples are now tested on every change.
- **Passing tests can still hide problems.** Warnings in the verbose test output pointed to invalid HTML in the story report dialog.
- **Free hosting shapes the design.** Sleeping services, a disk that resets, and an expiring database were not in the plan, and they changed how sample data, uploads, and the demo are handled.
- **My work came in bursts.** Most commits since Milestone 1 landed on a few days (129 on 7 October), with long gaps in between. I plan to work in small, regular steps until the final milestone.
- **Working with AI needs checks.** AI output can look right while being wrong; my checks caught several such mistakes (listed in AI_USAGE.md).

## 8. Plan for the period to the final milestone

| Task | Due |
|---|---|
| Pre-release 0.2.0-beta (tag milestone-2), report m2_ISIK.md and its links on Moodle, demo video, test credentials | Monday 30 November 2026, 18:00 |
| Demonstration in class on the deployed system | Tuesday 1 December 2026 |
| This milestone review, updated with the demo feedback | Saturday 5 December 2026, 23:59 |
| Code freeze and pre-release | Sunday 6 December 2026, 23:59 |
| Final report, digital, on Moodle | Friday 11 December 2026, 23:59 |
| Final report, bound hard copy, signed and identical to the digital one | Tuesday 15 December 2026, by 18:45 |

Work in this period, in small pull requests with a review comment on each before merging: a timed user test for NFR-01; an email provider on the deployment if time allows; the minor dependency updates; and fixes from the demo feedback.

## 9. AI usage summary for this period

I used one AI tool since Milestone 1, Claude Code (Anthropic's Claude, working in the repository from VS Code), for code generation, document generation, and report generation. **Not all of the code was generated with AI:** code is mixed by area, and overall I wrote about 60% of the application code myself, while about 40% was drafted with AI from tasks I specified. Documents and reports were drafted with AI from the code, the tests, and the issue history, then reviewed, corrected, and approved by me. I set each task, its details, and its limits, made the decisions, and checked the output through pull request reviews, the automated tests, and checks against the code and the live site. These checks caught several AI mistakes, listed in [AI_USAGE.md](../AI_USAGE.md), which has the full account.
