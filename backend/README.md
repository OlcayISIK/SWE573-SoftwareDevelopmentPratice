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

Requires Python 3.10+ and a PostgreSQL database.

```
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
source .venv/bin/activate     # macOS / Linux
pip install -e ".[dev]"
cp .env.example .env          # then edit DATABASE_URL
python manage.py migrate
python manage.py createcachetable
python manage.py runserver
```

## Checks

```
pytest
ruff check .
ruff format --check .
lint-imports
```
