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
  && apt-get install -y --no-install-recommends build-essential git \
  && rm -rf /var/lib/apt/lists/*

# prepare build dir
WORKDIR /app

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
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# copy compile-time config files before we compile dependencies
# to ensure any relevant config change will trigger the dependencies
# to be re-compiled.
COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

RUN mix assets.setup

COPY priv priv

COPY lib lib

# Compile the release
RUN mix compile

COPY assets assets

# compile assets
RUN mix assets.deploy

# Changes to config/runtime.exs don't require recompiling the code
COPY config/runtime.exs config/

COPY rel rel
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

COPY --from=builder --chown=nobody:root /app/_build/${MIX_ENV}/rel/chat ./
RUN chown nobody:root /app

FROM runtime AS youtube-client

# Only the isolated worker runs yt-dlp and validates YouTube metadata.
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs python3-pip \
  && pip3 install --break-system-packages --no-cache-dir --upgrade 'yt-dlp[default]' \
  && rm -rf /var/lib/apt/lists/*

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

FROM youtube-client AS youtube-worker

# Video preparation is isolated from web traffic, so only this image includes
# ffmpeg and the cache/streaming runtime.
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

USER nobody
CMD ["/app/bin/youtube-worker"]

# Keep `docker build .` suitable for the public chat in local development.
FROM app AS final
