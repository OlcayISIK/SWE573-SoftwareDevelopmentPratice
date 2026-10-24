#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py createcachetable
python manage.py collectstatic --noinput

# Local stacks start with sample crafts; production does not unless this is set.
if [ "${LOAD_SAMPLE_DATA:-false}" = "true" ]; then
    python manage.py load_sample_crafts
fi

# Requests are logged by the app (core.middleware), so Gunicorn's access log is off.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}"
