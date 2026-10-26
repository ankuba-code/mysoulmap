# backend/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY data/places.json ./data/places.json
COPY alembic.ini ./alembic.ini
COPY migrations/ ./migrations/

EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn src.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --access-logfile /dev/null --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]