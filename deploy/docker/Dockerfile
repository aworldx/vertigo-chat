ARG DEBIAN_VERSION=trixie-20260803-slim
ARG RUNNER_IMAGE=docker.io/debian:${DEBIAN_VERSION}

FROM golang:1.27.1-trixie AS go-toolchain

FROM go-toolchain AS api-builder
WORKDIR /src/apps/api
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
COPY contracts/fixtures/ /src/contracts/fixtures/
RUN go vet ./... && go test ./... \
  && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /api ./cmd/api \
  && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /migrate ./cmd/migrate

FROM go-toolchain AS youtube-builder
WORKDIR /src
COPY services/youtube-worker/ ./
RUN go vet ./... && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /youtube-worker .

FROM node:24.8.0-trixie-slim AS node-toolchain

FROM node-toolchain AS web-builder
WORKDIR /src
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# Permanent local gate: pinned toolchains, browser and image processing dependencies.
# Host files, credentials and Docker socket are never mounted into this image.
FROM go-toolchain AS quality
RUN apt-get update \
  && apt-get install -y --no-install-recommends git postgresql-client imagemagick \
  && rm -rf /var/lib/apt/lists/*
COPY --from=node-toolchain /usr/local /usr/local
COPY --from=golangci/golangci-lint:v2.13.2 /usr/bin/golangci-lint /usr/local/bin/golangci-lint
COPY --from=hadolint/hadolint:v2.12.0 /bin/hadolint /usr/local/bin/hadolint
COPY --from=koalaman/shellcheck:v0.10.0 /bin/shellcheck /usr/local/bin/shellcheck
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:27-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
RUN npm --prefix apps/web ci \
  && npm install --global @redocly/cli@1.34.5 \
  && npm exec --prefix apps/web -- playwright install-deps chromium \
  && (attempt=1; until PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000 npm exec --prefix apps/web -- playwright install chromium; do \
       if [ "$attempt" -ge 3 ]; then exit 1; fi; \
       echo "Chromium download failed; retrying in 15 seconds ($attempt/3)" >&2; \
       attempt=$((attempt + 1)); sleep 15; \
     done)
COPY apps/api/go.mod apps/api/go.sum ./apps/api/
COPY services/youtube-worker/go.* ./services/youtube-worker/
WORKDIR /app/apps/api
RUN go mod download
WORKDIR /app/services/youtube-worker
RUN go mod download
WORKDIR /app
COPY . .
CMD ["sh", "script/check-target"]

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
