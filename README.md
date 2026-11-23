# SWE573-SoftwareDevelopmentPratice
This repository was created for the SWE573 – Software Development Practice course project and its related requirements as part of the Master’s Program in Software Engineering at Boğaziçi University.

## Project: Interactive World Map of Indigenous Handmade Crafts

An interactive web-based world map that pinpoints handmade/indigenous craft items by geographic origin. Clicking a pin shows what the craft is, how it's made, the materials used, the culture/community behind it, and its current status (thriving, endangered, or extinct).

**Problem it addresses:** existing resources on indigenous crafts are scattered across academic papers, museum archives, and isolated blog posts. This project provides a single, visual, explorable, geography-anchored resource for discovering crafts contextually.

**Target users:** students, educators, cultural researchers, museum/heritage organizations, and casual learners interested in world cultures.

**Live site:** https://indigenous-crafts-swe.onrender.com (free hosting: the first visit after a quiet period can take about a minute).

## Installation

Requires Git and Docker with Compose v2 (Docker Desktop on Windows and macOS), 4 GB of RAM, and about 2 GB of free disk space.

```
git clone https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice.git
cd SWE573-SoftwareDevelopmentPratice
docker compose up --build
```

Then open http://localhost:5173 for the map, with 35 sample crafts, and http://localhost:8000/api/docs/ for the API documentation. To review reports, create an admin account:

```
docker compose exec backend python manage.py createsuperuser
```

The system requirements, installing without Docker, running the tests, and troubleshooting are on the wiki page [Installation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Installation).

## Project Management

- [Issues](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/issues) – tracked tasks and requirement-elicitation questions
- [Milestones](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/milestones) – Backend / Frontend, due 2026-12-12
- [Project board](https://github.com/users/OlcayISIK/projects/2) – roadmap and work-in-progress status
- [Wiki](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki) – deliverables, architecture, installation, testing, and requirement status
