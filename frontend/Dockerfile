# frontend/Dockerfile
# Prod-Image: docker buildx build --platform linux/amd64 -t ghcr.io/ankuba-code/mysoulmap-web:latest .
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80