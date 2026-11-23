# AI Usage

This document covers all use of AI in the Indigenous Crafts project since Milestone 1 (4 October 2026), up to the release on 23 November 2026. It states which tool was used, for which tasks, how much I relied on it, and how I checked and changed its output.

**Not all of the code was generated with AI.** By my own estimate, I wrote about 60% of the application code myself, and about 40% was drafted with AI assistance under my direction. AI was used most for documents and reports, and least for the decisions that shape the system.

## Summary for the report

I used one AI tool, Claude Code (Anthropic's Claude, working in the repository from VS Code), for three kinds of work: code generation, document generation, and report generation. Code is mixed by area: overall I wrote about 60% of the application code myself, and about 40% was drafted with AI from tasks I specified. Documents and reports (the updated SRS, the design documents, the test plan and results, the installation and user documentation, the milestone review, and the individual contributions) were drafted with AI from the code, the tests, and the issue history, then reviewed, corrected, and approved by me. In every case I set the task and its details and limits, made the decisions, and checked the output: every change went through a pull request that I reviewed and that had to pass 725 automated tests, and documents were checked against the code, the tests, and the live site. These checks caught several AI mistakes, listed under Limitations below. The interviews, the questionnaire, the user tests, and all decisions on scope and priorities were done by me without AI. Before Milestone 1, the research for the document analysis also used Claude, ChatGPT, and Gemini (NotebookLM), with each tool's answers cross-checked against another.

## Tool

| | |
|---|---|
| **Tool** | Claude Code: Anthropic's Claude models, used from VS Code with access to the repository, the terminal, and the GitHub command line |
| **Other AI tools since Milestone 1** | None (no ChatGPT, GitHub Copilot, or other assistants) |
| **Period** | 4 October to 23 November 2026 |
| **Before Milestone 1** | For the document analysis of existing craft resources (issue #6, 1 October 2026), Claude, ChatGPT, and Gemini (NotebookLM) were used to find sources and answer research questions; each tool's answers were checked against another tool's, and the findings were written up by me |

## How I worked with AI

**I set the task and its details.** Every piece of work started from a GitHub issue that I wrote, with acceptance criteria and an estimate. When I asked the AI to work on it, I gave the details: what to build or write, the design decisions it had to follow (for example the module boundaries, the response envelope, and the data model), and my conventions (short commit messages starting with add, fix, or update; plain wording in documents).

**I set the limits.** The AI did not decide requirements, scope, priorities, or the status of a requirement; I did. It did not merge anything on its own terms: every change went through a pull request on a protected main branch, and I decided whether to merge. Deployment secrets are kept in the Render and GitHub settings, not in the repository the AI worked in. Facts the AI could not know, such as the user test outcomes, the course deadlines, and which tools I used, came from me, and it was told not to invent them.

**I checked everything.** I read every change before it was merged. Code had to pass the backend, frontend, and end-to-end tests in CI, and I tried features in the running application. Documents were checked against the code, the test results, GitHub, and the live site, and the installation steps were run from a fresh clone. When a check failed, the AI's output was corrected before it was accepted.

## Use by area

| Area | What the AI did | Reliance | How I checked and changed it |
|---|---|---|---|
| Application code (backend and frontend) | Drafted parts of features from my task descriptions, boilerplate, refactoring, fixes, and data migrations; explained errors while debugging | Medium. Mixed by area: about 60% of the code is mine, about 40% AI-assisted (my estimate) | Reviewed every diff, changed it where needed, ran the tests locally and in CI, and tried the feature in the application |
| Tests | Drafted tests for the cases I listed, including the tests that send every documented API example to the API | Medium | Checked that each test checks the right behaviour; regression tests were checked to fail without their fix |
| CI/CD and Docker | Drafted the verbose test reports with coverage in CI and the fix to the Docker JWT key length | Medium | Ran the pipeline on a pull request and read the reports it produced |
| Requirements (SRS v1.0) | Drafted the changelog against Milestone 1 and the updated requirement text from the code and the issue history | High for the text, none for the decisions | I decided the priorities, which features are Won't in this release, and each status; checked each statement against the code |
| Design documents | Compared the architecture documents with the code and drafted the corrections; exported them as PDFs | High for the text | Approved each change; the comparison itself found stale and wrong statements |
| API documentation | Drafted the example requests and responses for eight endpoints | High | The examples are tested against the API on every change, and were compared with the live API |
| Test plan and results | Drafted the document and its tables from the verbose CI reports | High for the text | The figures are read from the reports; the user test section was written only from my own account of the tests |
| Installation and user documentation | Ran the installation from a fresh clone and drafted the instructions and the updated user guide | High for the text | I checked the steps and the measured figures, and the problems the run found were fixed in the documents |
| Reports (requirement status, milestone review, individual contributions, the summary in the final report) | Drafted the reports from GitHub data, the tests, and the documents | High for the text | I checked the figures against GitHub, set the plan's dates to the course deadlines, and approved each report |
| Document analysis (before Milestone 1) | Claude, ChatGPT, and Gemini (NotebookLM) found sources on UNESCO's and the V&A's records and answered research questions | Medium | Each tool's answers were cross-checked against another tool; I reviewed the sources and wrote the findings in issue #6 |
| Interviews, questionnaire, user tests, project decisions | Not used | None | Done by me: the interviews and questionnaire with people, the user test sessions, and every decision on scope and priorities |

## Limitations observed, and how my checks caught them

AI output often looks right while being wrong. These are real cases from this release:

- **Wrong statements in documents.** A draft of the SRS said every reporter is notified after a review; the code notifies only reporters of crafts and stories. A draft of the backend design kept saying that address search needs an account; it is public. Both were found by checking the documents against the code and its tests, and corrected.
- **Wrong figures.** A draft of the milestone review counted 33 issues at Milestone 1; GitHub shows 27. Figures are now read from GitHub or the test reports, not written from memory.
- **Damaged files.** One automated edit changed the text encoding of a source file and corrupted its characters. I caught it in the diff, and the file was restored from Git before anything was committed.
- **Instructions that did not work.** The installation steps had three errors that nobody noticed until the steps were run from a fresh clone: an install command that fails with older pip, a missing database command, and a Python release that cannot run the tests.
- **No knowledge outside the repository.** The AI cannot know what happened in user tests, what the course deadlines are, or which tools I used. I provided these facts; where it had to guess, such as the first draft of the plan's dates, I replaced the guess with the real dates.

## Responsibility

I am responsible for everything in this repository and its documents. All AI output was reviewed, changed where needed, and accepted by me before it became part of the project.
