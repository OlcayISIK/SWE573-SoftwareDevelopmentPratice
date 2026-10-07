FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL
RUN npm run build


FROM nginxinc/nginx-unprivileged:1.27-alpine

ENV API_ORIGIN=http://localhost:8000
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
