<!-- Назначение файла: краткая инструкция по запуску проекта и ссылка на архитектурные правила. -->

# Chat

## Architecture

Project architecture conventions are documented in [docs/architecture.md](docs/architecture.md).
The accepted [refactoring target](docs/refactoring_target.md) defines the monorepo
layout, React with strict TypeScript, Clean Architecture/DDD boundaries and
mandatory static analysis for every service, including the current gaps and
the order of implementation.
The [Go + React migration plan](docs/go_react_migration_plan.md) records the
working branch, completed work, remaining stages and how to resume in a new session.

To start your Phoenix server:

* Run `cd apps/phoenix && mix setup` to install and setup dependencies
* Start Phoenix endpoint with `cd apps/phoenix && mix phx.server` or inside IEx with `cd apps/phoenix && iex -S mix phx.server`

Now you can visit [`localhost:4000`](http://localhost:4000) from your browser.

## Hitchcock bot

Configure the bot through environment variables (the local `.env` file is ignored by Git):

```env
OPENAI_API_KEY=sk-...
OPENAI_BOT_MODEL=gpt-5.6-terra
OPENAI_BOT_RECEIVE_TIMEOUT_MS=120000
OPENAI_BOT_DAILY_TOKEN_LIMIT=120000
OPENAI_BOT_TOKEN_WARNING_PERCENT=90
OPENAI_BOT_UTC_OFFSET_MINUTES=180
```

For local development, export the file before starting Phoenix:

```sh
set -a
source .env
set +a
cd apps/phoenix && mix phx.server
```

The daily limit counts the exact `total_tokens` returned by the Responses API for replies and
memory summaries. At the warning percentage the bot announces that it is leaving, becomes busy,
and returns at local midnight. Set the daily limit to `0` to disable this application-level budget.

## Music search proxies

If the music provider requires authenticated HTTP proxies, store them outside the repository and
set `MUSIC_PROXY_FILE` to the absolute path. The file contains one
`host:port:username:password` entry per line. Do not commit the proxy list or include it in a
Docker image; mount it as a read-only secret/volume in production.

## S3 media storage

Photos, gallery thumbnails and chart audio can be moved to S3. Configuration,
backup, migration and rollback instructions are in [docs/s3_media.md](docs/s3_media.md).
ImageMagick is included in the production image; install it locally (`brew install
imagemagick` on macOS) to run thumbnail tests.

## Discourse forum

The chat can be the identity provider for a separate Discourse forum. Setup and
privacy details are in [docs/discourse_forum.md](docs/discourse_forum.md).

## Docker Compose deployment

Create the production environment file, replace every placeholder, then deploy:

```sh
cp .env.example .env
docker compose -f deploy/compose.yaml up --build -d
```

The `migrate` service applies all pending database migrations before `app` starts. Caddy waits for
the application healthcheck, and `OPENAI_API_KEY` is required by Compose so the bot cannot silently
start without its provider credentials. Keep values containing `$` in single quotes in `.env` so
Compose does not interpret part of the secret as another variable. The PostgreSQL password is also
embedded into `DATABASE_URL`, so use URL-safe characters or percent-encode reserved characters.

### Monitoring

The chat exposes aggregate Prometheus data at `GET /internal/metrics`. It has no browser pipeline
and requires `Authorization: Bearer $METRICS_TOKEN`; never route it through the public Caddy site.
The exporter includes HTTP request counts/latency, active and reconnecting sessions, public-message
counts by kind, and BEAM memory/run queue. It deliberately contains no message text, IP addresses,
nicknames, cookies, or tokens.

Compose starts Prometheus with 30-day retention and preconfigured scrape targets. Before starting it,
write the same value as `METRICS_TOKEN` into `METRICS_TOKEN_FILE` without a trailing newline, for
example `printf %s "$METRICS_TOKEN" > /opt/apps/vertigo-chat/.metrics_token`; make it readable by
Prometheus only: `chown root:65534 /opt/apps/vertigo-chat/.metrics_token && chmod 0640 /opt/apps/vertigo-chat/.metrics_token`.
Compose also starts `node-exporter` on the same private network (without a published port) for
VPS CPU, RAM, disk and network metrics. The included Prometheus rules cover failed chat scraping, low
free disk, sustained CPU use, 5xx growth and reconnect growth. Connect Grafana to
`http://prometheus:9090` from the private network for 1h/24h/7d charts and add Alertmanager for delivery
to Telegram/email; Prometheus and node-exporter are not exposed through Caddy.

For a small VPS, install `deploy/systemd/vertigo-chat-docker-prune.service` and
`deploy/systemd/vertigo-chat-docker-prune.timer` into `/etc/systemd/system/` and enable the timer. It runs
every Sunday around 04:30, removing only Docker build cache and unused images older than seven days.
It never removes running containers or volumes. The disk alert fires below 25% free space, giving the
cleanup time to run before storage becomes critical.

Grafana is available to the administrator at `/monitoring/` and requires its separate
`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`. Its pre-provisioned dashboard is named
**Vertigo chat — мониторинг**. Generate the password with `openssl rand -base64 36`; Grafana
does not allow self-registration.

The second provisioned dashboard, **Vertigo chat — состояние и алерты**, explains the indicators
and lists currently firing Prometheus rules.

Before the first deploy, create a writable host directory for the persistent application journal:

```sh
mkdir -p logs
chown 65534:root logs
chmod 0770 logs
```

The app writes its production journal to `./logs/chat.log`. Erlang Logger rotates it at 10 MiB and
keeps 14 compressed archives (`chat.log.0.gz` is the newest); tune these limits with
`CHAT_LOG_MAX_BYTES` and `CHAT_LOG_MAX_FILES`. The bind mount means this history survives an app
container recreation. Docker's `local` driver remains enabled as a short operational log; follow it
with `docker compose logs -f app`. Session lifecycle records start with `session_`.
For deployment without a domain, set `PHX_SCHEME=http`, `PHX_URL_PORT=80`, and
`CADDY_SITE_ADDRESS=http://SERVER_IP`.

### Current production VPS

The public production site is [vertigo-chat.ru](https://vertigo-chat.ru).
The instance runs on the Kazakhstan VPS at `109.248.170.47` in
`/opt/apps/vertigo-chat`. SSH access is key-only:

```sh
ssh root@109.248.170.47
```

The secret production values are stored only in `/opt/apps/vertigo-chat/.env`.
The server-specific public override is `/opt/apps/vertigo-chat/.env.vps`:

```env
PHX_HOST=vertigo-chat.ru
PHX_SCHEME=https
PHX_URL_PORT=443
```

To deploy a checked local change, commit it and push it to both `origin/main`
and `gitlab/main`. GitLab CI builds three `linux/amd64` images natively:
`app`, `admin` and `youtube-worker`. They are published under the project's
registry path as `registry.gitlab.com/aworldx1/vertigo-chat:<role>-<commit
SHA>`. The VPS only pulls finished images: it never runs `mix deps.get` or
`docker compose build`.

For a private GitLab image, create a GitLab project deploy token with only
`read_registry` permission and place it only in
`/opt/apps/vertigo-chat/.env`:

```env
GITLAB_REGISTRY_USERNAME=gitlab_deploy_token_username
GITLAB_REGISTRY_TOKEN=gitlab_deploy_token_value
```

Keep the token unquoted and do not copy it into the repository. If the GitLab
image is public, omit both variables and the script pulls it anonymously. Wait
for the **build_production_image** GitLab pipeline for the commit to finish,
then run the deploy command. The script rejects a dirty tree or a revision
different from `origin/main`, pulls that exact SHA, and waits for each updated
container to become healthy. With no argument it migrates and updates every
role. A targeted update skips migrations, so use it only when the target does
not require a schema change.

```sh
(cd apps/phoenix && mix precommit)
git add <files>
git commit -m "Describe the change"
git push origin main

bash script/deploy-production

# Independently update one role after its image has been built.
bash script/deploy-production admin
bash script/deploy-production app
bash script/deploy-production youtube-worker
```

The firewall allows only SSH, HTTP and HTTPS; password authentication is
disabled. Do not use `rsync --delete` against the production directory.

Ready to run in production? Please [check our deployment guides](https://phoenix.hexdocs.pm/deployment.html).

## Learn more

* Official website: https://www.phoenixframework.org/
* Guides: https://phoenix.hexdocs.pm/overview.html
* Docs: https://phoenix.hexdocs.pm
* Forum: https://elixirforum.com/c/phoenix-forum
* Source: https://github.com/phoenixframework/phoenix

## React migration preview

The first React screen is available at `/profiles/react`, backed by the public
`/api/v1/profiles` API. The default `/profiles` route remains on LiveView.
Run `cd apps/phoenix && mix assets.setup` once to install the pinned npm dependencies, then
`cd apps/phoenix && mix assets.build` and `mix phx.server`. React interaction tests run as part of
`cd apps/phoenix && mix precommit` or separately with `npm --prefix apps/web test`.

See [the migration plan and local checks](docs/react_migration.md) and
[the API contract](contracts/openapi/profiles.yaml).

## Local YouTube worker (Go)

YouTube search, metadata, downloads and the MP4 cache run in `services/youtube-worker/`.
Phoenix communicates with it over HTTP using Req. The worker needs Go 1.25+,
`yt-dlp`, Node.js (YouTube JavaScript challenges), and `ffmpeg` in PATH.
The Go service uses the standard library only; yt-dlp and ffmpeg remain external tools.

Start two terminals from the repository root:

```sh
script/youtube-worker
```

```sh
cd apps/phoenix && mix phx.server
```

The defaults are chat at http://localhost:4000/chat and the worker at
http://localhost:4001. For parallel local testing, use:

```sh
YOUTUBE_WORKER_PORT=4011 script/youtube-worker
cd apps/phoenix && PORT=4010 YOUTUBE_WORKER_URL=http://localhost:4011 YOUTUBE_PROXY_BASE_URL=http://localhost:4011 mix phx.server
```

`cd apps/phoenix && mix precommit` checks Go formatting, runs `go vet` and `go test -race`, then
runs the Elixir tests. Run `script/check-go` for the Go checks alone.
Set `GO=/path/to/go` if the SDK is not in PATH.

Worker configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `YOUTUBE_WORKER_HOST` | `127.0.0.1` (`0.0.0.0` in Docker) | Bind address |
| `YOUTUBE_WORKER_PORT` | `4001` | HTTP port |
| `YOUTUBE_CACHE_DIR` | OS temp directory + `chat-youtube-cache` | Persistent MP4 cache |
| `YOUTUBE_CACHE_MAX_BYTES` | `2147483648` | Cache size limit |
| `YOUTUBE_CACHE_MAX_PREPARATIONS` | `1` | Concurrent video downloads |
| `YOUTUBE_REQUEST_TIMEOUT_MS` | `25000` | Search/metadata timeout |
| `YOUTUBE_DOWNLOAD_TIMEOUT_MS` | `120000` | Download/merge timeout |
| `YOUTUBE_YT_DLP_PATH` | `yt-dlp` | Downloader executable |
| `YOUTUBE_FFMPEG_PATH` | `ffmpeg` | MP4 processing executable |

The cache deduplicates downloads, queues up to 128 pending videos, expires entries
idle for six hours and evicts least recently used files to stay within its limit.
Failed downloads have a 30-second retry cooldown. Ready MP4s survive restarts;
interrupted temporary downloads are cleaned up at startup. Use one worker process
per cache directory. Metadata operations are limited to four concurrent requests.

HTTP contract: `GET /health`, `POST /youtube/search` (`query`),
`POST /youtube/prepare` (`source_url`), `GET|HEAD /youtube-proxy/:video_id`.
The proxy returns `202` with `Retry-After: 1` while downloading, then serves MP4
with byte ranges. Only YouTube IDs are accepted; live, unknown-duration and
longer-than-20-minute videos are rejected. Search uses yt-dlp's flat playlist
metadata and returns up to five eligible results.

The `youtube-worker` Docker target builds the Go binary independently of the
Phoenix release. It does not receive application/database secrets in Compose.
