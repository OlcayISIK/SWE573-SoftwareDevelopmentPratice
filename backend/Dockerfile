FROM python:3.13-slim AS build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY pyproject.toml ./
RUN pip install .


FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.production

RUN useradd --create-home --uid 1000 app

WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY --chown=app:app . .
RUN chmod +x entrypoint.sh \
    && mkdir -p staticfiles media \
    && chown app:app staticfiles media

USER app
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
