# backend/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY data/places.json ./data/places.json
COPY data/country_centroids.csv ./data/country_centroids.csv
#COPY data/GeoLite2-Country.mmdb ./data/GeoLite2-Country.mmdb
#COPY data/GeoLite2-City.mmdb ./data/GeoLite2-City.mmdb
COPY alembic.ini ./alembic.ini
COPY migrations/ ./migrations/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

CMD ["sh", "-c", "exec gunicorn src.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --access-logfile /dev/null --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]