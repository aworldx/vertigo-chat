<!-- Назначение файла: краткая инструкция по запуску проекта и ссылка на архитектурные правила. -->

# Chat

## Architecture

Project architecture conventions are documented in [docs/architecture.md](docs/architecture.md).

To start your Phoenix server:

* Run `mix setup` to install and setup dependencies
* Start Phoenix endpoint with `mix phx.server` or inside IEx with `iex -S mix phx.server`

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
mix phx.server
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

## Docker Compose deployment

Create the production environment file, replace every placeholder, then deploy:

```sh
cp .env.example .env
docker compose up --build -d
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
and `gitlab/main`. GitLab CI builds the `linux/amd64` image natively and
publishes it as `registry.gitlab.com/aworldx1/vertigo-chat:<commit SHA>`. The
VPS only pulls that finished image: it never runs `mix deps.get` or `docker
compose build`.

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
different from `origin/main`, pulls that exact SHA (retrying for up to five
minutes), migrates, recreates `app` and `admin`, and checks the local endpoint.

```sh
mix precommit
git add <files>
git commit -m "Describe the change"
git push origin main

bash script/deploy-production
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
