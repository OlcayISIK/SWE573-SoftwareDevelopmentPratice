# Indigenous Crafts Backend

Django REST API for Indigenous Crafts.

## Run with Docker

From the repository root:

```
docker compose up --build
```

- API: http://localhost:8000/api/v1/
- Swagger UI: http://localhost:8000/api/docs/
- Django admin: http://localhost:8000/admin/

Create an admin account:

```
docker compose exec backend python manage.py createsuperuser
```

## Run locally

Requires Python 3.10 or newer (not 3.10.0) and a PostgreSQL 16 database. All steps, the system requirements, and troubleshooting are on the wiki page [Installation](https://github.com/OlcayISIK/SWE573-SoftwareDevelopmentPratice/wiki/Installation).

```
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
source .venv/bin/activate     # macOS / Linux
python -m pip install --upgrade pip
pip install ".[dev]"
cp .env.example .env          # then edit DATABASE_URL, DJANGO_SECRET_KEY, JWT_SIGNING_KEY
python manage.py migrate
python manage.py createcachetable
python manage.py load_sample_crafts     # optional: 35 sample crafts
python manage.py runserver
```

Upgrade pip first: the pip that comes with older Pythons cannot install this project.

## Checks

```
pytest
ruff check .
ruff format --check .
lint-imports
```
