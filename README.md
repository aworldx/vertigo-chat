<!-- Назначение файла: запуск целевого Go + React приложения и эксплуатация. -->

# Chat

Целевой стек — Go API на стандартном `net/http`, React со строгим TypeScript,
PostgreSQL и Caddy. Go отдаёт API и собранный React с одного origin; Caddy
завершает TLS и проксирует запросы к API. Phoenix сохранён только как pinned
legacy checkout для сравнения при миграции и не входит в Docker, Compose или CI
целевого стека.

Архитектурные правила находятся в [docs/architecture.md](docs/architecture.md),
целевая структура — в [docs/refactoring_target.md](docs/refactoring_target.md),
а состояние переноса — в [docs/go_react_migration_plan.md](docs/go_react_migration_plan.md).

## Локальный Go + React

Нужны PostgreSQL, Go 1.25+ и Node.js. Целевая БД использует существующую
схему приложения; Go-мигратор добавляет только таблицы, которыми владеет Go.

```sh
npm --prefix apps/web ci
npm --prefix apps/web run build
cd apps/api
DATABASE_URL=postgresql://localhost/chat_dev go run ./cmd/migrate
DATABASE_URL=postgresql://localhost/chat_dev API_ADDR=127.0.0.1:4020 API_PUBLIC_ORIGIN=http://127.0.0.1:4020 WEB_ASSETS_DIR=../web/dist go run ./cmd/api
```

Откройте <http://127.0.0.1:4020/>. Для сравнения с legacy используйте
`LEGACY_ROOT=/path/to/legacy script/verify-go-web`; сценарии и одинаковые
viewport описаны в [docs/migration_testing.md](docs/migration_testing.md).

## Проверки

```sh
script/check-go
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run format:check
npm --prefix apps/web test
script/check-infrastructure
```

`script/check-go` использует установленный Go или закреплённый Docker-образ
Go, поэтому локальная проверка не требует отдельной установки SDK при наличии
Docker.

Пока Phoenix остаётся в репозитории для legacy-сравнений, обязательный общий
локальный gate из [AGENTS.md](AGENTS.md) также запускается командой
`cd apps/phoenix && mix precommit`.

## Docker Compose

Создайте production environment file, замените placeholders и поднимите уже
собранные образы:

```sh
cp .env.example .env
docker compose -f deploy/compose.yaml up -d
```

Сервис `migrate` применяет Go-миграции перед запуском `api`. Caddy ждёт
healthcheck `api` на `:4020`; API и React наружу не публикуются напрямую.
`OPENAI_API_KEY` обязателен, чтобы бот не запускался без провайдера. Значения с
`$` в `.env` заключайте в одинарные кавычки; пароль PostgreSQL должен быть
URL-safe или percent-encoded, поскольку включён в `DATABASE_URL`.

CI собирает `linux/amd64` образы `api` и `youtube-worker`. Перед production
cutover отдельно подтвердите миграцию схемы существующей БД, healthchecks,
восстановление и rollback; текущая ветка не публикует и не развёртывает их.

### Monitoring

API выдаёт агрегированные HTTP-метрики через `GET /internal/metrics` только с
`Authorization: Bearer $METRICS_TOKEN`. Метрики не содержат путей, личных
данных, cookies или токенов. Caddy блокирует этот маршрут снаружи, а Prometheus
скрейпит `api:4020` по внутренней сети.

Перед запуском создайте файл с тем же значением без перевода строки:

```sh
printf %s "$METRICS_TOKEN" > /opt/apps/vertigo-chat/.metrics_token
chown root:65534 /opt/apps/vertigo-chat/.metrics_token
chmod 0640 /opt/apps/vertigo-chat/.metrics_token
```

Grafana доступна на `/monitoring/` и использует отдельные
`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`. Prometheus также собирает
метрики VPS и контейнеров через node-exporter и cAdvisor.

## Hitchcock bot

Настройте бот через переменные окружения:

```env
OPENAI_API_KEY=sk-...
OPENAI_BOT_MODEL=gpt-5.6-terra
OPENAI_BOT_RECEIVE_TIMEOUT_MS=120000
OPENAI_BOT_DAILY_TOKEN_LIMIT=120000
OPENAI_BOT_TOKEN_WARNING_PERCENT=90
OPENAI_BOT_UTC_OFFSET_MINUTES=180
```

Лимит учитывает `total_tokens` Responses API для ответов и summaries. При
достижении предупреждающего порога бот сообщает о паузе и возвращается в
полночь выбранной временной зоны. Значение `0` отключает лимит приложения.

## Media and YouTube worker

Для music search можно задать `MUSIC_PROXY_HOST_FILE`: это путь к файлу вне
репозитория, по одной записи `host:port:username:password` на строку. Compose
монтирует его read-only как `/run/secrets/music_proxies`.

Фото, превью галереи и аудио чарта могут храниться в S3; параметры и процедура
переноса описаны в [docs/s3_media.md](docs/s3_media.md). ImageMagick включён в
образ API; для локальных thumbnail-тестов на macOS установите его через
`brew install imagemagick`.

YouTube search, preparation и MP4 cache обслуживает `services/youtube-worker/`.
Он запускается отдельно и доступен API по внутреннему URL; Caddy передаёт
`/youtube-proxy/*` worker-у для range streaming. Локальный worker запускается
командой `script/youtube-worker` и требует Go 1.25+, `yt-dlp`, Node.js и
`ffmpeg` в `PATH`.
