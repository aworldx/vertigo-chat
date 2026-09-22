# Проверка standalone React + Go, 2026-09-22

Проверен срез входа, регистрации и анкет. Главная страница, `/chat`, настройки
аккаунта и прочие разделы ещё не перенесены. Корень Go-стенда временно
перенаправляет на `/profiles`; после входа открываются анкеты.

## Версии и данные

- Новая версия: незакоммиченная `codex/go-react-migration` поверх
  `0734268bd59a6a84178d3040fefd805e707ff6cb`.
- Legacy: тот же SHA, отдельный checkout `/tmp/chat-web-legacy-0734268`.
  Исходники legacy не изменялись.
- Два backend используют независимые копии только схемы локальной `chat_test`
  и одинаковые fixtures из `script/fixtures/go-web.sql`. Production и dev-данные
  не копируются. Go сам применяет свою миграцию account sessions.
- 13 пользователей `fixture01`…`fixture13`, пароль `secret123`, одинаковые
  имя/описание/ранг/счётчики. Гостевые screenshots сняты до UI write-сценариев.
- Chromium из закреплённого Playwright 1.57.0; locale `ru-RU`, timezone
  `Europe/Moscow`, dark scheme, device scale 1. Старый и новый сайт открыты
  в разных browser contexts: cookies изолированы.

## Сравнение

| Сценарий | 390×844 | 768×1024 | 1440×900 |
| --- | --- | --- | --- |
| Вход | 0 отличающихся пикселей | 0 | 0 |
| Регистрация | 0 | 0 | 0 |
| Каталог анкет | 0 | 0 | 0 |
| Диалог fixture01 | 0 | 0 | 0 |

Отдельно совпали geometry, font-family, font-size, line-height и размеры
заголовка; горизонтального overflow нет. Порог пиксельной разницы — **0**,
маски не применяются. Скрипт завершится с ошибкой при любом отличии.
Пары `old.png` / `new.png`, красные `diff.png` и метрики `report.json`
находятся в `apps/web/migration-results/go-web/` (локальные артефакты,
игнорируются git). Они не удаляются обычным Playwright `test:browser`.

Проверка ждёт шрифты, network idle и конкретное содержимое диалога.
Вход/регистрация/каталог снимаются full-page, модальный диалог — в viewport:
его backdrop ограничен экраном. Ранний full-page capture включал загрузчик
и невидимый каталог вне viewport с артефактами Chromium compositing.
После исправления ожиданий и области захвата все 12 сравнений прошли без
допусков и изменения продуктовых стилей ради теста.

В pinned legacy root отсутствует подключение существующего
`account_login.js`, поэтому на `/account/login` остаётся loader. Для сравнения
исходной формы browser script подключает **неизменённый legacy bundle**
через `addScriptTag`. Это явное исправление тестового setup, не изменение
legacy checkout. Standalone React монтирует форму штатно.

## Поведение

`verify-go-accounts` и `verify-go-web` проверяют настоящий React UI:

- неверный пароль, сетевая ошибка и повтор;
- регистрацию с кириллицей и появление пользователя;
- вход fixture-пользователя с прежним PBKDF2 hash;
- редактирование анкеты, reload, очистку nullable-поля и повторный reload;
- загрузку валидного PNG, выдачу фото/thumbnail;
- отклонение mutation без CSRF;
- logout и синхронизацию второй вкладки через BroadcastChannel;
- сохранение независимого chat sessionStorage.

Отдельные Go/PostgreSQL и API-browser проверки охватывают миграцию и её
повтор, atomic registration/guard, единственного first admin, session
expiry/revocation, cookie, CSRF и хранение только hash session token.

Исправления относительно текущего кода: `null` теперь очищает поле профиля,
`user_id` из тела mutation отклоняется, toolbar выхода находится выше fixed
фона. В SQL reaper задан timestamp type, чтобы PostgreSQL не выводил interval
для параметра времени. Последний дефект обнаружился при запуске реальной БД.

## Повторный запуск и ручной стенд

```sh
# В legacy checkout сначала установить assets и выполнить mix assets.build.
# Из корня текущего репозитория:
LEGACY_ROOT=/tmp/chat-web-legacy-0734268 KEEP_MIGRATION_STAND=1 script/verify-go-web
```

По умолчанию Go — `http://127.0.0.1:4043`, legacy —
`http://127.0.0.1:4044`. Команда остаётся запущенной; Ctrl-C останавливает
оба процесса и удаляет их disposable databases. Можно задать `GO_WEB_PORT`
и `LEGACY_WEB_PORT`. Последний успешный автоматический прогон использовал
4050/4051, чтобы не мешать уже открытому ручному сравнению на 4043/4044.

Отдельный ручной Go-стенд оставлен на `http://127.0.0.1:4040/profiles` и
`/account/login`, с БД `chat_web_go_41857`; её не сбрасываем во время просмотра.
Пароль fixture-аккаунтов указан выше. Сервер должен оставаться запущенным:
фоновые процессы тестового shell не гарантируют доступность после его выхода.

Go API и UI проверяются также командой `script/verify-go-accounts` на 4042;
она входит в CI quality. Old/new screenshot comparison пока запускается
локально: CI не поднимает отдельный pinned legacy checkout автоматически.
Этап не означает ручного принятия пользователем или готовности общего cutover.

## Завершённые проверки

- `GO=/tmp/chat-go-sdk/go/bin/go GOCACHE=/tmp/chat-go-cache mix precommit`
  из `apps/phoenix`: Go formatting/static/race/build, Credo/Dialyzer,
  generated contracts, strict TypeScript, ESLint/architecture, Prettier,
  8 React tests, standalone build, 3 legacy visual tests, 411 ExUnit — passed.
- `script/verify-go-accounts`: PostgreSQL integration/race, API browser и
  React UI flow — passed.
- `LEGACY_ROOT=... GO_WEB_PORT=4050 LEGACY_WEB_PORT=4051 script/verify-go-web`:
  12 pixel-exact сравнений и UI flow — passed.
- `script/check-infrastructure`: ShellCheck, Hadolint, Redocly и Compose —
  passed. Сохраняются информационное замечание о соседних Docker RUN и
  предупреждения license в двух OpenAPI-контрактах.
- `docker build --target profiles-api -t chat-go-web-migration-check
  -f deploy/docker/Dockerfile .`: standalone Go + React image — passed.

Коммиты, push, публикация образа и изменения production не выполнялись.
