# Two stages, one image: Node builds the front end, the Python image carries the
# result. Nothing Node-related survives into the running container — nginx serves
# the built files and the only runtime process is gunicorn.

# Stage 1: build the Nuxt SPA
# Node 22, not 20: Nuxt 4's build uses Set.prototype.difference, which only
# arrived in Node 22. On 20 the build dies with "trustedFunctions.difference is
# not a function", which does not obviously point at the Node version.
FROM node:22-alpine AS frontend

WORKDIR /build
COPY src/site/package.json src/site/package-lock.json ./
# --legacy-peer-deps because npm's resolver chokes on Nuxt's peer graph.
RUN npm ci --legacy-peer-deps

COPY src/site/ ./
# `generate` with ssr:false emits a static site to .output/public.
RUN npm run generate

# Stage 2: Django, plus the built front end
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY src/django/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/django/ .
COPY --from=frontend /build/.output/public /app/frontend-dist

COPY etc/docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
