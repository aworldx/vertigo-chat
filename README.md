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

To deploy a checked local change, commit it and push it to `origin/main`. The
production image is assembled on the local development machine for
`linux/amd64`, then transferred directly to the VPS. The VPS never runs `mix
deps.get` or `docker compose build`: this keeps a transient Hex/GitHub problem
from blocking a production deploy.

The local Docker installation must have Buildx available; Docker Desktop
provides it. The script refuses a dirty working tree or a local revision that
does not exactly match `origin/main`. It transfers only the resulting image,
not source files or either production environment file.

```sh
mix precommit
git add <files>
git commit -m "Describe the change"
git push origin main

bash script/deploy-production
```

The script verifies the fast-forwarded revision, runs `migrate` using the
transferred image, recreates only `app` and `admin` with `--no-build`, then
checks the local production endpoint. The firewall allows only SSH, HTTP and
HTTPS; password authentication is disabled. Do not use `rsync --delete`
against the production directory.

Ready to run in production? Please [check our deployment guides](https://phoenix.hexdocs.pm/deployment.html).

## Learn more

* Official website: https://www.phoenixframework.org/
* Guides: https://phoenix.hexdocs.pm/overview.html
* Docs: https://phoenix.hexdocs.pm
* Forum: https://elixirforum.com/c/phoenix-forum
* Source: https://github.com/phoenixframework/phoenix
