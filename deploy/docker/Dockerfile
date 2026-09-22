# This file is based on these images:
#
#   - https://hub.docker.com/r/hexpm/elixir/tags - for the builder image
#     E.g.: docker.io/hexpm/elixir:1.20.3-erlang-29.0.5-debian-trixie-20260803-slim
#   - https://hub.docker.com/_/debian/tags?name=trixie-20260803-slim - for the runner image
#     E.g.: docker.io/debian:trixie-20260803-slim
#
# Find builder and runner images on Docker Hub or on Hex's Build Server (Bob).
# We recommend using Bob's Web UI to find recent tags:
#
#   - https://bob.hex.pm/docker
#
# We suggest using the same Debian version for both the builder and runner images.
#
# We suggest Debian/Ubuntu instead of Alpine to avoid production compatibility issues
# (such as DNS resolution failures, and dynamically linked NIFs/precompiled binaries).
#
# For finding packages in Debian, search on https://packages.debian.org/.

ARG ELIXIR_VERSION=1.20.3
ARG OTP_VERSION=29.0.5
ARG DEBIAN_VERSION=trixie-20260803-slim

ARG BUILDER_IMAGE="docker.io/hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="docker.io/debian:${DEBIAN_VERSION}"

FROM ${BUILDER_IMAGE} AS builder

# install build dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git nodejs npm \
  && rm -rf /var/lib/apt/lists/*

# prepare build dir
WORKDIR /app/apps/phoenix

# install hex + rebar
RUN mix local.hex --force \
  && mix local.rebar --force

# Set build ENV. The VPS occasionally has short stalls while Hex fetches the
# package registry; serialize those requests and allow enough time for a
# complete response so deploys do not fail on a transient registry timeout.
ENV MIX_ENV="prod" \
    HEX_HTTP_TIMEOUT="120" \
    HEX_HTTP_CONCURRENCY="1"

# install mix dependencies
COPY apps/phoenix/mix.exs apps/phoenix/mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# copy compile-time config files before we compile dependencies
# to ensure any relevant config change will trigger the dependencies
# to be re-compiled.
COPY apps/phoenix/config/config.exs apps/phoenix/config/${MIX_ENV}.exs config/
RUN mix deps.compile

COPY apps/web/package.json apps/web/package-lock.json ../web/
RUN mix assets.setup

COPY apps/phoenix/priv priv

COPY apps/phoenix/lib lib

# Compile the release
RUN mix compile

COPY apps/web ../web

# compile assets
RUN mix assets.deploy

# Changes to config/runtime.exs don't require recompiling the code
COPY apps/phoenix/config/runtime.exs config/

COPY apps/phoenix/rel rel
RUN mix release

# Shared runtime for the three release roles. Keep it lean: role-specific
# multimedia tools are installed only in the image that needs them.
FROM ${RUNNER_IMAGE} AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 locales ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Set the locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
  && locale-gen

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

WORKDIR "/app"

# set runner ENV
ENV MIX_ENV="prod"

COPY --from=builder --chown=nobody:root /app/apps/phoenix/_build/${MIX_ENV}/rel/chat ./
RUN chown nobody:root /app

FROM runtime AS app

# The public chat creates profile-photo thumbnails.
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends imagemagick \
  && rm -rf /var/lib/apt/lists/*

USER nobody
CMD ["/app/bin/server"]

FROM runtime AS admin

# The isolated admin endpoint serves Phoenix and database requests only.
# It deliberately excludes ImageMagick and the YouTube toolchain.
USER nobody
CMD ["/app/bin/server"]

FROM golang:1.27.1-trixie AS youtube-builder
WORKDIR /src
COPY services/youtube-worker/ ./
RUN go vet ./... && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /youtube-worker .

FROM golang:1.27.1-trixie AS profiles-api-builder
WORKDIR /src
COPY apps/api/ ./
RUN go vet ./... && go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /profiles-api ./cmd/api

# CI executes the same repository checks in this pinned toolchain image. It is
# deliberately not used by production targets.
FROM ${BUILDER_IMAGE} AS quality
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential git nodejs npm shellcheck \
  && rm -rf /var/lib/apt/lists/*
COPY --from=youtube-builder /usr/local/go /usr/local/go
COPY --from=golangci/golangci-lint:v2.13.2 /usr/bin/golangci-lint /usr/local/bin/golangci-lint
COPY --from=hadolint/hadolint:v2.12.0 /bin/hadolint /usr/local/bin/hadolint
ENV PATH="/usr/local/go/bin:${PATH}" MIX_ENV="test"
WORKDIR /app/apps/phoenix
RUN mix local.hex --force && mix local.rebar --force
COPY apps/phoenix/mix.exs apps/phoenix/mix.lock ./
COPY apps/phoenix/config config
RUN mix deps.get
COPY apps/web/package.json apps/web/package-lock.json ../web/
RUN mix assets.setup && npx --prefix ../web playwright install --with-deps chromium
WORKDIR /app
COPY . .
WORKDIR /app/apps/phoenix
RUN find /app/script -maxdepth 1 -type f ! -name '*.exs' -exec shellcheck {} + \
  && hadolint --config /app/deploy/.hadolint.yaml /app/deploy/docker/Dockerfile \
  && npm exec --yes --package=@redocly/cli@1.34.5 -- redocly lint /app/contracts/openapi/profiles.yaml

# Standalone Go service: no BEAM release, database or application secrets.
FROM ${RUNNER_IMAGE} AS youtube-worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl nodejs python3-pip ffmpeg \
  && pip3 install --break-system-packages --no-cache-dir 'yt-dlp[default]==2026.8.19' \
  && rm -rf /var/lib/apt/lists/*
COPY --from=youtube-builder /youtube-worker /app/bin/youtube-worker
ENV YOUTUBE_WORKER_HOST=0.0.0.0 YOUTUBE_CACHE_DIR=/var/cache/chat-youtube
USER nobody
CMD ["/app/bin/youtube-worker"]

FROM ${RUNNER_IMAGE} AS profiles-api
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl imagemagick \
  && rm -rf /var/lib/apt/lists/*
COPY --from=profiles-api-builder /profiles-api /app/bin/profiles-api
ENV API_ADDR=0.0.0.0:4020
USER nobody
CMD ["/app/bin/profiles-api"]

# Keep `docker build .` suitable for the public chat in local development.
FROM app AS final
