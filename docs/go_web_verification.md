# Проверка standalone React + Go, 2026-09-22

Проверены главная, guest/registered entrance и формы регистрации, а также
ранее перенесённые account login/register и анкеты. Go сам отдаёт `/` и
`/chat`; React-комната пока реализует только базовые сообщения, список online,
reconnect/outbox и явный выход. Полный UI комнаты, настройки аккаунта и прочие
разделы ещё предстоит перенести. Ссылки на эти разделы на главной сохранены
как в legacy; наличие ссылки не означает готовность целевого маршрута.

## Версии и данные

- Новая версия: незакоммиченные изменения `codex/go-react-migration` поверх
  `d231c59`.
- Legacy: `0734268bd59a6a84178d3040fefd805e707ff6cb`, отдельный checkout
  `/tmp/chat-web-legacy-0734268`. Его исходники не изменялись.
- Независимые БД с копией только схемы локальной `chat_test` и одинаковыми
  fixtures `script/fixtures/go-web.sql`: 13 пользователей `fixture01`…`fixture13`,
  пароль `secret123`, одинаковые анкеты, счётчики и ранги. Production/dev-данные
  не копируются. Go применяет свою миграцию account sessions.
- Chromium Playwright 1.57.0, locale `ru-RU`, timezone `Europe/Moscow`, dark,
  scale 1, CPU rasterization (`--disable-gpu`); отдельные browser contexts
  изолируют cookies обеих версий.
- Screenshots явно загружают обе font-face через `document.fonts.load`,
  проверяют loaded, ждут network idle и итоговое содержимое; pointer и scroll
  приводятся к одному состоянию. Формы снимаются full-page, диалог — в viewport,
  поскольку его backdrop ограничен экраном. Масок нет.

## Сравнение

На 390×844, 768×1024 и 1440×900 проверяются 13 состояний:

- главная с формой входа и главная с регистрацией;
- вход: неправильный ник, зарегистрированный ник без пароля, неверный пароль;
- регистрация: неправильный ник, короткий пароль, неправильный email, занятый ник;
- account login/register, каталог анкет, диалог fixture01.

Все 39 основных сравнений дали **0 отличающихся пикселей**; geometry, font-family,
font-size, line-height и размеры заголовка совпали, overflow нет.
Дополнительно проверяются обе формы у CSS-breakpoints: 430/431, 639/640,
760/761/767/768, 1000/1001 px (768 уже входит в основную матрицу).
Восемь дополнительных снимков на 431/639/640/760 px имеют 1–2 отличающихся
пикселя в афише, максимум один уровень одного цветового канала. Source PNG
побайтово одинаков, geometry/object-fit/object-position/opacity совпадают;
разница воспроизводится и с CPU Chromium. Допуск ограничен двумя пикселями
внутри афиши, только на дополнительных breakpoint-снимках, после проверки
идентичности PNG и геометрии. Raw diff сохраняется. Более сильная разница,
третий пиксель и любое изменение вне афиши завершают тест ошибкой; это
проверено отдельным тестом. Основные 39 снимков требуют точного совпадения.

Пары `old.png` / `new.png`, красные `diff.png` и метрики `report.json`:
`apps/web/migration-results/go-web/` (локальные артефакты, игнорируются git).

В pinned legacy root отсутствует подключение существующего `account_login.js`.
Тест подключает неизменённый legacy bundle через `addScriptTag`, чтобы сравнить
форму, а не loader; standalone React монтирует её штатно.

## Исправления и поведение

У мобильного описания первого экрана восстановлены пробелы вокруг скрытых
`br`: JSX удалял переносы/пробелы и склеивал слова. CSS и шрифты не менялись.
Go теперь возвращает `registration_nickname`, `registration_password` и
`registration_email` в chat entrance API. Accounts сохраняет совместимость
старого `invalid_registration` через wrapping application errors. PostgreSQL
различает unique constraints ника и email; проверен откат quota после обоих
отказов, включая email с другим регистром. Схема и владелец данных не менялись.

Ссылки регистрации во время ожидающего entrance не размонтируют форму.
`landing-flow.ts`, вызываемый `verify-go-chat`, проверяет нижнюю ссылку,
переключение форм, Tab, задержанный запрос, disabled/loading, запрет второго
входа, сетевую ошибку/повтор, вход fixture01, resume с главной и удаление resume
после явного выхода. Остальные chat-сценарии проверяют гостя, занятый ник,
сообщения двух вкладок, reload, запрет дублированной вкладки, reconnect/outbox,
независимость site logout и отказ browser storage.

`verify-go-accounts` проверяет actual PostgreSQL schema, повторяемые миграции,
atomic registration/first admin, отказ без частичной записи, sessions/expiry/
revocation/race. Browser flow покрывает cookie/CSRF, неверный пароль, регистрацию,
reload, profile edit/очистку nullable-поля/upload, выдачу original/thumbnail,
logout во второй вкладке и сохранение независимого chat storage.

## Повторный запуск и ручной стенд

```sh
# В legacy checkout заранее установить assets и выполнить mix assets.build.
GO=/tmp/chat-go-sdk/go/bin/go GOCACHE=/tmp/chat-go-cache \
LEGACY_ROOT=/tmp/chat-web-legacy-0734268 \
GO_WEB_PORT=4050 LEGACY_WEB_PORT=4051 KEEP_MIGRATION_STAND=1 script/verify-go-web
```

Go — `http://127.0.0.1:4050/`, legacy — `http://127.0.0.1:4051/`.
Проверить главную на узком/широком экране, переключение форм и ошибки входа;
затем войти гостем либо `fixture01` / `secret123`. Команда должна оставаться
запущенной; Ctrl-C завершает оба процесса и удаляет только созданные ею БД.
Старые стенды 4040/4044 не обновлялись этим этапом; проверять health перед
использованием. В legacy и Go разные БД и cookies, вход выполняется отдельно.

## Проверки этапа

- `script/verify-go-chat`: integration/race и расширенный React entrance/chat flow — passed.
- `script/verify-go-accounts`: PostgreSQL/race, account API и React UI — passed.
- `script/check-infrastructure`: passed. Существующие предупреждения:
  отсутствует license в трёх OpenAPI, realtime Snapshot не используется HTTP
  операцией, Hadolint замечает соседние RUN.
- `mix precommit`: passed — Go lint/vet/race/build, Credo/Dialyzer,
  contracts, TypeScript/ESLint/Prettier, 9 frontend tests, standalone build,
  3 browser tests и 411 ExUnit.
- Финальный `verify-go-web`: passed, 57 сравнений (49 exact, 8 с описанным
  округлением афиши), затем account/profile browser flow. Оба стенда оставлены
  запущенными на 4050/4051 для ручной проверки.

Docker-линтеру был недоступен `proxy.golang.org`. Финальный precommit запускался
с той же закреплённой `golangci/golangci-lint:v2.13.2`, `GOPROXY=off` и volume
локального `/tmp/chat-go-modcache`, дополненного из существующего host Go cache.
Локальный wrapper — `/tmp/chat-migration-tools/golangci-lint`; команда:
`PATH=/tmp/chat-migration-tools:$PATH GO=/tmp/chat-go-sdk/go/bin/go
GOCACHE=/tmp/chat-go-cache mix precommit`. Проверки не отключались.

Не запускать несколько `npm run build` параллельно с `verify-go-web`: эти
команды заменяют общий `apps/web/dist`. Такой прогон однажды снял страницу
с fallback-шрифтом; он отклонён. Финальная визуальная проверка выполняется
последовательно после остальных сборок, с явной проверкой font-face.

Сравнение с отдельным pinned legacy checkout запускается локально; оно не
добавлено в CI автоматически. Этап не означает ручного принятия пользователем
или готовности полного cutover. Коммиты, push и production не выполнялись.
