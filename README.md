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
OPENAI_BOT_MODEL=gpt-5.4-nano
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
For deployment without a domain, set `PHX_SCHEME=http`, `PHX_URL_PORT=80`, and
`CADDY_SITE_ADDRESS=http://SERVER_IP`.

### Current production VPS

The current production instance runs on the Kazakhstan VPS at `109.248.170.47` in
`/opt/apps/vertigo-chat`. SSH access is key-only:

```sh
ssh root@109.248.170.47
```

The secret production values are stored only in `/opt/apps/vertigo-chat/.env`.
The server-specific public override is `/opt/apps/vertigo-chat/.env.vps`:

```env
PHX_HOST=109.248.170.47
PHX_SCHEME=http
PHX_URL_PORT=80
CADDY_SITE_ADDRESS=http://109.248.170.47
```

To deploy a checked local change, do not copy either environment file. Run the
checks locally, upload the source, then build and restart the Compose stack:

```sh
mix precommit

rsync -az \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.env.vps' \
  --exclude='_build/' \
  --exclude='deps/' \
  --exclude='assets/node_modules/' \
  ./ root@109.248.170.47:/opt/apps/vertigo-chat/

ssh root@109.248.170.47 '\
  cd /opt/apps/vertigo-chat && \
  docker compose --env-file .env --env-file .env.vps build app && \
  docker compose --env-file .env --env-file .env.vps up -d && \
  docker compose --env-file .env --env-file .env.vps ps'
```

`migrate` runs before the application starts. Verify the result with
`curl -I http://109.248.170.47`. The firewall allows only SSH, HTTP and HTTPS;
password authentication is disabled. Do not use `rsync --delete` against the
production directory.

Ready to run in production? Please [check our deployment guides](https://phoenix.hexdocs.pm/deployment.html).

## Learn more

* Official website: https://www.phoenixframework.org/
* Guides: https://phoenix.hexdocs.pm/overview.html
* Docs: https://phoenix.hexdocs.pm
* Forum: https://elixirforum.com/c/phoenix-forum
* Source: https://github.com/phoenixframework/phoenix
