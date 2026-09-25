ARG DEBIAN_VERSION=trixie-20260803-slim
ARG RUNNER_IMAGE=docker.io/debian:${DEBIAN_VERSION}

FROM golang:1.27.1-trixie AS api-builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
RUN go vet ./... && go test ./... \
  && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /api ./cmd/api \
  && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /migrate ./cmd/migrate

FROM golang:1.27.1-trixie AS youtube-builder
WORKDIR /src
COPY services/youtube-worker/ ./
RUN go vet ./... && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /youtube-worker .

FROM node:24.8.0-trixie-slim AS web-builder
WORKDIR /src
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# CI uses the same Go and Node toolchains as production builds. Phoenix stays
# outside this target and is used only from a pinned legacy checkout for visual
# migration comparisons.
FROM api-builder AS quality
RUN apt-get update \
  && apt-get install -y --no-install-recommends git shellcheck postgresql-client imagemagick \
  && rm -rf /var/lib/apt/lists/*
COPY --from=web-builder /usr/local /usr/local
COPY --from=golangci/golangci-lint:v2.13.2 /usr/bin/golangci-lint /usr/local/bin/golangci-lint
COPY --from=hadolint/hadolint:v2.12.0 /bin/hadolint /usr/local/bin/hadolint
WORKDIR /app
COPY . .
RUN npm --prefix apps/web ci \
  && npm exec --prefix apps/web -- playwright install-deps chromium \
  && (attempt=1; until PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 npm exec --prefix apps/web -- playwright install chromium; do \
       if [ "$attempt" -ge 3 ]; then exit 1; fi; \
       echo "Chromium download failed; retrying in 15 seconds ($attempt/3)" >&2; \
       attempt=$((attempt + 1)); sleep 15; \
     done) \
  && find /app/script -maxdepth 1 -type f ! -name '*.exs' ! -name '*.mjs' -exec shellcheck {} + \
  && hadolint --config /app/deploy/.hadolint.yaml /app/deploy/docker/Dockerfile \
  && npm exec --yes --package=@redocly/cli@1.34.5 -- redocly lint /app/contracts/openapi/*.yaml

FROM ${RUNNER_IMAGE} AS api
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl imagemagick \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-builder /api /app/bin/api
COPY --from=api-builder /migrate /app/bin/migrate
COPY --from=web-builder /src/dist /app/web
ENV API_ADDR=0.0.0.0:4020 WEB_ASSETS_DIR=/app/web
USER nobody
CMD ["/app/bin/api"]

FROM ${RUNNER_IMAGE} AS youtube-worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nodejs python3-pip ffmpeg \
  && pip3 install --break-system-packages --no-cache-dir 'yt-dlp[default]==2026.8.19' \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=youtube-builder /youtube-worker /app/bin/youtube-worker
ENV YOUTUBE_WORKER_HOST=0.0.0.0 YOUTUBE_CACHE_DIR=/var/cache/chat-youtube
USER nobody
CMD ["/app/bin/youtube-worker"]

# Keep `docker build .` useful for a local target-stack smoke run.
FROM api AS final
