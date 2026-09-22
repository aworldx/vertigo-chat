# План переезда на Go + React

Обновлено: 2026-09-23. Рабочая ветка: `codex/go-react-migration`.
Это точка продолжения для следующих сессий. Архитектурные требования и целевое
дерево каталогов находятся в [refactoring_target.md](refactoring_target.md).
Обязательная процедура проверки каждого среза — в
[migration_testing.md](migration_testing.md): параллельный локальный запуск
старой и новой версий, функциональное и визуальное сравнение, отчёт для пользователя.

## Цель и ограничения

Полностью заменить UI на React + строгий TypeScript, а backend на Go. Всё
остаётся в одной монорепе. Phoenix сохраняется целиком только в отдельной
legacy-ветке и не является fallback или proxy целевой реализации.

- Работать в отдельной ветке миграции `codex/go-react-migration` до полного
  завершения миграции; не переносить изменения в main автоматически.
- Пользователь выбрал полный cutover в этой ветке: не создавать feature flags,
  обратимые Phoenix proxy, LiveView fallback или новые Phoenix write-path.
- До полного завершения миграции не делать production rollout: не выполнять
  push, публикацию образов, деплой или изменения production. Разрешены только
  проверки локальных стендов. Коммиты — только после нового указания пользователя.
- Сохранять внешний вид, особенно шрифты, отступы и поведение диалогов.
  Смена технологии сама по себе не является задачей редизайна.
- Для каждого сценария сначала закрепить Go HTTP/WebSocket контракт, затем
  перенести React UI и browser-тесты. Phoenix-код в этой ветке не расширять.
- Один владелец записи и миграций на область данных; без dual write.

## Текущее состояние

### Продолжение: приватные настройки аккаунта (2026-09-23)

Перенесён `/account`: просмотр/изменение форумного email, ошибки,
уведомление сохранения, reload, отказ сети и повтор. Гость входит прямо
на `/account`; legacy-переход в неперенесённую библиотеку не копируется.
Go Accounts владеет приватными `GET /api/v1/account/settings` и
`PUT /api/v1/account/settings/email`; actor из cookie, CSRF/same-origin,
уникальность email через существующий индекс. Новых миграций нет.
Игры не переносились.

Изменения поверх `2dcb146` (предыдущий этап помощи закоммичен по указанию
пользователя), текущий этап без commit/push/production.
35 пар снимков pixel-exact на пяти viewport; PostgreSQL и browser Accounts
прошли. Итоговый `mix precommit` прошёл (411 ExUnit, 15 frontend, 3 browser,
Go/TypeScript quality gates). Детали и результаты общего gate:
[go_account_settings_verification.md](go_account_settings_verification.md).
Go `http://127.0.0.1:4098/account`,
legacy `http://127.0.0.1:4099/account`,
`fixture01` / `secret123`. Ручное принятие ещё не получено.

Следующий раздел — визиты `/visits`; затем фотоальбом, библиотека,
статьи, админка и форумная интеграция. Игры остаются исключены.
Полный cutover ещё не завершён.

### Предыдущий этап: помощь и справочник званий (2026-09-23)

По новому указанию пользователя продолжается миграция отдельных разделов,
**игры не переносить**. Изменения поверх `c95acc6`, без commit/push/production.

Перенесены `/help` и `/ranks`: команды, система званий и открываемые
возможности. Публичный Go `GET /api/v1/ranks` использует тот же Profiles domain,
что расчёт ранга участника. Новых write owners и миграций нет.
React разделён на API/model/UI, использует строгий TypeScript и исходные ресурсы.
Отчёт и воспроизведение: [go_help_verification.md](go_help_verification.md).

14 пар снимков обоих маршрутов на семи ширинах pixel-exact, без допуска;
ошибка загрузки, повтор, reload и клавиатурный фокус проверены.
Вход/выход проверены на трёх viewport; три дополнительных сравнения
после диагностического исправления слоя панели legacy pixel-exact.
Исходная авторизованная панель legacy затемнена и блокирует клики;
существующее исправление React сохранено и объяснено в отчёте.
Два прогона `mix precommit` прошли (411 ExUnit); итоговые TS/lint/format
и browser runner (17 сравнений) прошли.
Стенды Go `http://127.0.0.1:4096/help`,
legacy `http://127.0.0.1:4097/help`.
Ручное принятие пользователем ещё не получено.

Следующее продолжение: настройки аккаунта `/account`, затем оставшиеся
разделы (визиты, фотоальбом, библиотека, статьи, админка и форумная интеграция)
с Go-контрактами и проверкой обеих версий. Игры исключены.
Общая миграция и production cutover ещё не завершены.

### Предыдущий этап: общая комната целиком (2026-09-22)

Пользователь изменил порядок: не разбивать дальнейшую работу на один UI-элемент
за сессию; завершать общую комнату комплексно. **Игры пока не переносить.**
Изменения локальные, поверх `d2caf73`, без commit/push/production.

Перенесены общая комната, команды, личные/адресные сообщения, настройки,
реакции, Хичкок и Кармик с общим token budget, музыка/GIF/YouTube, хит-парад,
статусы доставки и передача файлов по запросу с relay/MSE streaming.
Реальные музыка через пользовательские прокси, GIF и YouTube playback проверены.
`music-proxies.txt` скопирован из Downloads, права 0600, исключён из Git.

`verify-go-chat` прошёл PostgreSQL и browser-сценарии, включая три состояния
галочек, blocked reload, private privacy, хит-парад/🎧 и проигрывание MP3 до
конца relay-передачи. `verify-go-web`: 23 room/chart сравнения (узкий проверяемый допуск для
округления тёмных пикселей Chromium описан в отчёте);
отдельный media parity: 6/6 music/YouTube search снимков pixel-exact.
Финальный обязательный `mix precommit` прошёл: 411 ExUnit, 15 frontend, 3 browser,
Go lint/vet/race/build, strict TS/ESLint/Prettier, Credo/Dialyzer и contracts.

Стенд: Go `http://127.0.0.1:4094/`, legacy `http://127.0.0.1:4095/`;
`fixture01` / `secret123`. Детали проверок, команды и ограничения:
[go_chat_room_verification.md](go_chat_room_verification.md).

Этап готов к ручной проверке локальной версии; автоматические quality gates
прошли. Ручное принятие пользователем ещё не получено.
Прямой WebRTC ICE в окружении не соединяется; relay передаёт байты и streaming
подтверждён. Реальный платный OpenAI и production S3 не вызывались. Локальный hub
нуждается в multi-instance transport перед production cutover. Игры и другие
отдельные разделы не включать без следующего указания пользователя.

Ниже — история предыдущих узких этапов; их «следующий шаг» заменён этим разделом.


Текущий незавершённый срез (2026-09-22): главная React, гостевой/зарегистрированный
вход и базовая общая комната доступны на локальном `http://127.0.0.1:4050/`.
Добавлены public entrance API, Go WebSocket, reconnect, outbox и явный выход.
`script/verify-go-chat` проверяет их на отдельной временной БД; integration и
browser-сценарии прошли. Полный перенос интерфейса и возможностей legacy-чата
ещё не завершён. Главная, обе формы и ошибки входа/регистрации теперь проверены
относительно pinned legacy; отчёт текущего этапа ниже. Таблица и этап 6
не означают готовность полного интерфейса чата.

### Продолжение: базовый список участников (2026-09-22)

Изменения поверх `d2caf73`, без коммита. Перенесены гостевые строки online list:
значок, ник, публичное обращение мышью/клавиатурой, статусы присутствия,
счётчик и скрытие sidebar на мобильном. Go Peer DTO дополнен `registered` и
`self`; собственная запись определяется ID сессии, а не ником. Локальная потеря
связи сразу меняет только собственный status; восстановление сохраняет DOM
строки, завершённые сессии исчезают. Новых миграций и владельцев записи нет.

Это ограниченный срез: зарегистрированный значок пока статический; ранги,
персональные цвета, открытие анкеты, приватное обращение, bot/Кармик,
музыка и настройки sidebar ещё требуют переноса. Полная комната и composer
не объявляются готовыми. Область сравнения, команды и результаты:
[go_chat_online_verification.md](go_chat_online_verification.md).
12 пар снимков: 10 pixel-exact, две отличаются только 1/3 пикселями
сглаживания нативной рамки фокуса при одинаковых геометрии/стилях. Узкий
допуск и его регрессионный тест описаны в отчёте. `verify-go-chat` и
`check-infrastructure` и финальный `mix precommit` прошли (411 ExUnit, 14 frontend).
Пользователь попросил не останавливаться на срезах и закончить общую комнату
одним этапом. Полный этап сейчас в работе; изменения prefs/room UI ниже
ещё не прошли итоговую проверку и не должны считаться принятыми.

Стенды для ручной проверки: Go `http://127.0.0.1:4054/`, legacy
`http://127.0.0.1:4055/`, отдельные disposable БД. Войти гостем; для проверки
другого участника открыть вторую вкладку/контекст. Зарегистрированный вход —
`fixture01` / `secret123`. Ручное принятие ещё не получено.

**Следующий шаг:** продолжить общую комнату — данные/действия зарегистрированных
участников (оформление, ранг, анкета) либо composer, по одному Go-контракту и
React-сценарию с old/new проверкой. Не считать текущие компонентные сравнения
принятием всего интерфейса. Commit, push и production не выполнялись.

### Продолжение: первый срез ленты комнаты (2026-09-22)

Локальные изменения поверх `2f0445d`, без коммита. Перенесены карточки обычных
текстовых/системных сообщений: рамки, автор, локальное время, публикация,
сохранённые цвета/шрифты и ссылки. Feed и outbox выделены из Room в отдельные
компоненты; прокрутка следует за низом, но сохраняет чтение истории и DOM
при snapshot. Нажатие на автора заполняет обращение и фокусирует composer;
неотправленное сообщение можно повторить или удалить из tab-scoped outbox.

Go отдаёт явный Message DTO с appearance/font_id/font_style, читая существующие
поля `room_messages`. Новых миграций нет. Найден и исправлен timezone-сдвиг
новых сообщений и входа при не-UTC timezone PostgreSQL; тест использует
`Asia/Kathmandu`. Старые данные не переписываются. Accounts не переносился
повторно, Phoenix не расширялся, write owners прежние.

Сравнение ограничено карточками собственных сообщений гостя и обычной
системной записью. Это не готовность всей комнаты. Меню, composer, online list,
настройки, реакции, emoji/media, личка, выделение адресата и специальные notices
ещё не перенесены. Сохранённое оформление старых сообщений читается, но
настройки для новых отправок остаются следующим этапом.

Команды, область сравнения и 24 пары пиксельно совпадающих снимков:
[go_chat_feed_verification.md](go_chat_feed_verification.md). Все 24 сравнения
pixel-exact, без допуска. `mix precommit` прошёл: 411 ExUnit, 11 frontend,
3 browser, Go lint/vet/race/build, contracts, TypeScript/ESLint/Prettier,
Credo/Dialyzer. Финальные `verify-go-chat` и `check-infrastructure` прошли.
Оставлены Go `http://127.0.0.1:4052/` и legacy `http://127.0.0.1:4053/`
на отдельных disposable БД. Go использует отдельную копию собранных assets,
чтобы другие локальные сборки не ломали стенд. Войти гостем `feed-reader`
для просмотра фиксированной истории. Этап доступен для ручной проверки;
принятия пользователем нет. Коммит, push и production не выполнялись.

**Следующий шаг:** продолжить общую комнату с composer/online list и недостающими
действиями по одному, закрепляя Go contract перед UI. Визуальное сравнение
карточек не заменяет последующего сравнения целой комнаты без нормализации
окружения. Не запускать Phoenix fallback и не считать миграцию завершённой.

### Продолжение: главная и ошибки входа (2026-09-22)

Текущие изменения поверх `d231c59` в `codex/go-react-migration`, без коммита.
Завершено сравнение главной с legacy `0734268bd59a6a84178d3040fefd805e707ff6cb`:
исправлены пробелы около скрытых мобильных переносов; сохранены шрифты,
композиция, формы и сообщения ошибок. Go теперь различает ошибки ника,
пароля и email при регистрации; HTTP-контракт обновлён. Конфликты уникальности
ника/email возвращаются через Accounts application errors; старый auth API
сохраняет совместимый `invalid_registration`. Изменения схемы не нужны,
владение Accounts/Entrance и транзакции остаются прежними.

Во время ожидающего входа ссылки регистрации больше не размонтируют форму:
это предотвращает второй параллельный вход из той же страницы. Browser flow
проверяет задержанный запрос, одну отправку, сетевой отказ и повтор, Tab,
переход из нижней ссылки в регистрацию, registered entrance и resume с главной.
Go/PostgreSQL проверяет отдельные причины отказов и откат registration guard
после занятого ника или email (включая регистр email).

Проверки: `verify-go-chat`, `verify-go-accounts`, `check-infrastructure` и
`mix precommit` прошли (411 ExUnit, 9 frontend, 3 browser, Go lint/vet/race/build,
contracts, strict TS/ESLint/Prettier, Credo/Dialyzer). `verify-go-web` прошёл:
57 сравнений, 49 pixel-exact; восемь breakpoint-снимков отличаются только
1–2 пикселями афиши на один уровень цвета, при одинаковых исходных PNG и
геометрии. Все основные 39 снимков (13 состояний × 3 viewport) pixel-exact.
Обоснование узкого допуска, команды и снимки:
[go_web_verification.md](go_web_verification.md).

Стенды оставлены запущенными: Go `http://127.0.0.1:4050/`, legacy
`http://127.0.0.1:4051/`, `fixture01` / `secret123`; независимые disposable БД.
Проверить переключение форм/ошибки на узком и широком экране, затем гостевой
либо зарегистрированный вход. Этап готов к ручной проверке; пользовательское
принятие ещё не получено. Коммит, push и production не выполнялись.

**Следующий этап после главной — интерфейс общей комнаты React.** Сопоставить legacy shell,
ленту, composer и online list со сценарием Go, затем расширять public contract
и переносить оставшиеся действия чата по одному. Базовый transport уже есть;
не начинать заново Accounts или Phoenix proxy. Presence/reconnect/outbox/leave
проверены функционально, но это не визуальное принятие всей комнаты, не полный
перенос её функций и не завершение нагрузочных/отказных проверок.

Исправление локального входа: Chrome открывал `localhost:4040`, тогда как
`API_PUBLIC_ORIGIN` задан как `http://127.0.0.1:4040`. Строгая проверка Host
отклоняла даже GET account-session и показывала «Сессия изменилась».
Go теперь перенаправляет навигацию по локальным страницам с loopback-алиаса
на настроенный origin с тем же портом; проверки API/CSRF/WebSocket сохранены.
Обычный Chrome проверен вручную: перенаправление и гостевой вход работают.
Есть регрессионные тесты для loopback, другого порта, production и API.
Production, схема БД и пользовательские данные этим исправлением не менялись.
После исправления прошли `mix precommit` (411 ExUnit, 8 React, 3 browser,
Go vet/lint/race, TypeScript/ESLint/Prettier и контракты) и повторный
`script/verify-go-chat`, включая навигацию с localhost и гостевой вход.

| Часть | Сделано | Ещё не сделано |
| --- | --- | --- |
| YouTube worker | Переписан на Go и расположен в `services/youtube-worker`; поиск, подготовка, кэш, proxy/range; отдельная сборка Docker; golangci-lint, `gofmt`, `go vet`, race-тесты | Полный production Docker build проверяется в CI quality/build pipeline |
| React-анкеты | Строгий TypeScript; Go отдаёт standalone React, каталог, диалог, редактор и фото; old/new проверены на трёх viewport | Ручное принятие нового standalone delivery; LiveView остаётся только legacy |
| API анкет | Go public read/write API; текущий пользователь определяется account-cookie и CSRF, media выдаётся Go | Удалить исторический Phoenix proxy код при завершении общего cutover |
| Accounts и chat-session | React login/register/logout и главная подключены к Go; guest/registered entrance, базовый WebSocket/Presence, PBKDF2, cookie/CSRF, editor/upload и выход проверены | Полный React chat UI и его визуальное сравнение; настройки аккаунта и административные сценарии |
| Архитектура | Standalone web build в `apps/web/src`, Go web delivery, Docker target `profiles-api` содержит React; quality gates работают | Полностью исключить Phoenix из Docker/Compose/CI после переноса остальных контекстов |

React/API и документация входят в первый коммит ветки миграции после Go-воркера.
Старый каталог анкет `/profiles` остаётся основным. Подробности первой итерации:
[react_migration.md](react_migration.md), [OpenAPI](../contracts/openapi/profiles.yaml).

Последняя проверка 2026-09-22: `GO=/tmp/chat-go-sdk/go/bin/go`
`GOCACHE=/tmp/chat-go-cache script/check` завершился успешно — Go formatting/vet/race,
strict TypeScript, ESLint, Prettier, 7 React interaction-тестов и 408 ExUnit-тестов.
Первый прогон выявил флак `Chat.LogFileHandlerTest`, второй прошёл полностью.
После коммита `bcf7e9e` локальный opt-in сценарий
`DATABASE_URL=... GO=... script/verify-go-profile-write` снова прошёл: cookie+CSRF
Phoenix направил text edit и PNG upload единственному Go writer, а реальный
React browser подтвердил итоговую проекцию и выдачу media. Production flags не
включались. Инвентаризация оставшихся экранов находится в
[migration_inventory.md](migration_inventory.md); следующий UI-срез — ранги.
Локальная browser-проверка на `http://localhost:4031/profiles/live` и
`http://localhost:4031/profiles/react` подтвердила загрузку каталога, поиск с URL
`q`, пагинацию, открытие профиля по URL `profile`, Escape и возврат фокуса.
Скриншоты и метрики LiveView/React на 390×844, 768×1024 и 1440×900 совпали после
исправления разметки ранга, SVG-заглушки фото и пагинации; горизонтального overflow
нет. Кнопки увеличения и закрытия фотографии разнесены в противоположные углы
в React и LiveView fallback; на профиле `guest-gSmK` их области не пересекаются.
Для повторяемой проверки добавлен Playwright: он поднимает Phoenix на 4032,
сохраняет пары снимков в `apps/web/test-results/` и сравнивает метрики old/new на
трёх viewport; `npm run browsers:install` один раз устанавливает Chromium.
Временный стенд на 4031 запущен для ручного принятия пользователя.
Пользователь вручную принял React-анкеты 2026-09-22; временный LiveView fallback
сохраняется, production-переключение не выполнялся. Новый единый `script/check`
успешно выполнил все текущие gates: Go, TypeScript, ESLint, Prettier, React,
Playwright и 408 ExUnit-тестов.
`script/check-contracts` пересоздаёт DTO из OpenAPI и проверяет, что они не
расходятся со сгенерированным TypeScript. Credo 1.7.19 и Dialyxir 1.4.8 добавлены
как dev/test-зависимости. В `script/check-credo` зафиксирован проверяемый legacy
baseline Credo из 100 замечаний (2 warnings, 44 refactoring, 38 readability, 16
design): новые и исчезнувшие записи блокируют gate, поэтому baseline уменьшается
явным изменением. `.dialyzer_ignore.exs` содержит 16 строгих записей для 19
legacy-предупреждений Dialyzer; `--list-unused-filters` блокирует stale baseline.
`script/check-go` использует golangci-lint 2.13.2, ShellCheck 0.10.0, Hadolint
2.12.0 и Redocly 1.34.5 запускаются в закреплённых контейнерах. CI quality
собирает непроизводственный target `quality`, проверяет инфраструктуру и запускает
`cd apps/phoenix && mix precommit` с изолированной PostgreSQL до production image build.
Phoenix перенесён в `apps/phoenix`: Mix-проект, конфигурация, исходники, тесты,
миграции, release overlays и Elixir baselines больше не лежат в корне. Общие
скрипты остаются в `script`; `script/check` входит в Phoenix перед запуском
`mix precommit`. Docker и CI собирают проект из `apps/phoenix`, React остаётся
в `apps/web`, а assets выводятся в `apps/phoenix/priv/static`. Локальные старые
`_build`, `deps`, `cover` остаются проигнорированными как удаляемый cache.
Проверка 2026-09-22: `GO=/tmp/chat-go-sdk/go/bin/go`
`GOCACHE=/tmp/chat-go-cache mix precommit` из `apps/phoenix` прошёл; включены
Dialyzer/Credo, Go, контракт, strict TypeScript/ESLint/Prettier, 7 interaction-
тестов, Playwright-сравнение LiveView/React на 390×844, 768×1024, 1440×900 и
ExUnit. Визуальное сравнение не выявило различий метрик или overflow.

## Текущий незакоммиченный срез Accounts (2026-09-22)

Реализован public Go API `/api/v1/auth/{session,login,register,logout}` вместо
внутреннего Accounts proxy. Контракт: [accounts.yaml](../contracts/openapi/accounts.yaml).
Phoenix использует подписанную cookie и при выходе удаляет `account_user_id` из
новой cookie; серверного отзыва сохранённой старой cookie в legacy нет.
Текущая Go-реализация следует прежнему пункту плана об opaque session и добавляет
серверный отзыв, для которого предусмотрена новая таблица `account_sessions`.
Это дополнительное свойство, а не обязательное условие React/Go. После вопроса
пользователя о различиях рекомендовано сохранить серверные сессии из действующего плана: они позволяют отозвать старую cookie при выходе.
Это архитектурное решение миграции; production rollout по-прежнему не разрешён.

База и существующие данные сохраняются. `registered_users`, password hashes и
`security_registration_guards` используются в прежней схеме. Лишняя новая
таблица registration claims удалена; Go воспроизводит Erlang fingerprint для
IPv4/IPv6 и UTC day, сохраняя ранее записанные ограничения. Регистрация и claim
атомарны; конкурентное создание первого аккаунта выдаёт admin только одному.

На изолированной копии **только схемы** `chat_test` проверены миграция Go,
повторный запуск, регистрация, profile trigger, rollback лимита, конкурентные
сессии, expiry/revocation и реальный Chromium flow: cookie/CSRF, вход, reload,
выход во второй вкладке и сохранение tab-scoped storage. Команда:
`GO=/tmp/chat-go-sdk/go/bin/go GOCACHE=/tmp/chat-go-cache script/verify-go-accounts`.
Она создаёт и удаляет `chat_accounts_test_*`; исходную БД не изменяет.
Новые browser-проверки написаны на строгом TypeScript и включены в lint/typecheck.

`ACCOUNTS_GO_API_URL`/`ACCOUNTS_INTERNAL_TOKEN` удалены из Compose; legacy Phoenix
код не расширялся. На первом API-срезе UI ещё не подключался; следующий
standalone-срез описан ниже. Его предыдущий `mix precommit` прошёл: Go static/race/build,
Credo/Dialyzer, generated contracts, strict TypeScript/ESLint/Prettier,
8 React tests, 3 browser-сравнения анкет и 411 ExUnit tests. Отдельный
`script/check-infrastructure` прошёл (Redocly предупреждает об отсутствии
license в обоих контрактах; Hadolint сообщает о соседних RUN).
`script/check` исправлен на запуск infrastructure из правильного каталога и
теперь также запускает `verify-go-accounts`; сценарий добавлен в CI quality.
При переключении UI пользователи войдут заново: Go не принимает старую Phoenix
cookie, но использует прежние password hashes. Go migrations добавляют только
`account_sessions` и служебный `go_schema_migrations`; существующие таблицы не
пересоздаются. Команда `cmd/migrate` применяется отдельно перед запуском API.
Go public API проверен при прямом соединении; X-Forwarded-For не доверяется.
Перед реальным reverse proxy нужен явный доверенный peer adapter, иначе
регистрации будут иметь общий IP прокси. Полный Docker build и CI job локально
не запускались.
Изменения не коммитились, production не затрагивался.

## Незакоммиченный standalone web-срез (2026-09-22)

Go самостоятельно отдаёт React на `/account/login`, `/account/register` и
`/profiles`, включая login/register/logout, каталог, диалог, редактирование
своей анкеты и фото. `WEB_ASSETS_DIR` указывает на `apps/web/dist`; сборка
через npm/esbuild/Tailwind не требует Phoenix. Статические шрифты/изображения
скопированы без изменения; общие правила CSS выделены в `site.css`.
React разделён на `app → pages → features → shared`; проверка направления
импортов и публичных entrypoint включена в npm lint. Accounts feature не
зависит от Profiles: их связывает page. DTO генерируются из OpenAPI.

Go public `/api/v1/account/profile` и `/api/v1/account/profile/photo` проверяют
account-session и CSRF; входной `user_id` не принимается. Фото совместимы
с прежними публичными URL. Phoenix не участвует в целевом auth/write flow.
Исправлены очистка полей через JSON `null`, перекрытие кнопки выхода фоном
и тип timestamp в SQL reaper, найденный на реальной локальной PostgreSQL.

12 снимков login/register/catalogue/dialog на 390×844, 768×1024 и 1440×900
совпали побайтово по пикселям с legacy SHA
`0734268bd59a6a84178d3040fefd805e707ff6cb`. Подробности, исключение legacy
login bundle и команды: [go_web_verification.md](go_web_verification.md).
`verify-go-accounts` проверяет API и UI на своей БД/порту 4042; сравнение
`verify-go-web` использует ещё две отдельные БД и по умолчанию 4043/4044.

**Историческое ограничение standalone-среза до переноса главной:** `/` временно ведёт на `/profiles`;
`/chat`, `/account` settings, игры, библиотека и остальные разделы пока 404.
После входа пользователь попадает в анкеты. Это промежуточный local preview,
не готовность полного cutover. Старую главную можно открыть на legacy-стенде.
Полноценный перенос главной требует её guest/registered entrance, сохранения
tab-scoped resume-secret и рабочего React chat через public Go transport.

Для ручной проверки запущен Go на `http://127.0.0.1:4040`, тестовый аккаунт
`fixture01` / `secret123`. База `chat_web_go_41857` изолирована от dev/production;
не сбрасывать её во время ручной проверки. API запущен отдельным foreground
процессом; прежний background-сервер завершался вместе с тестовым shell.
`KEEP_MIGRATION_STAND=1` теперь удерживает родительский процесс; команда должна
оставаться запущенной. Не считать старые URL живыми без проверки health.

Проверки этого среза прошли: `mix precommit` (Go static/race/build,
Credo/Dialyzer, контракты, strict TS/ESLint/Prettier, 8 React tests, standalone
build, 3 прежних Playwright comparisons, 411 ExUnit), `verify-go-accounts`,
`verify-go-web` и `check-infrastructure`. Docker target `profiles-api` успешно
собран в локальный образ `chat-go-web-migration-check`, без публикации.
Полный production Compose/CI rollout не выполнялся. Изменения не коммитились.

## Этапы и критерии завершения

### 1. Укрепить первый React-срез — следующий шаг

- [x] Перевести interaction-тесты на `.tsx`; entry point, экран и transport API уже TypeScript.
- [x] Настроить строгий TypeScript и отдельный `tsc --noEmit` для нового transport/model-кода.
- [x] Разделить поиск, список/карточку, пагинацию, диалог профиля и фото;
      запросы, состояние/URL и UI разнести по ответственности.
- [x] Расширить ESLint с типовой информацией, Hooks, accessibility,
      проверкой импортов/циклов и Prettier на TSX-тесты; strict ESLint и Prettier уже проверяют экран.
- [x] Проверить соответствие нового клиента контракту: DTO генерируются `openapi-typescript`, а JSON валидируется на transport-границе.
- [x] Сохранить тесты пользовательского поведения, собрать assets и проверить
      в браузере поиск, страницы, deep links, назад/вперёд, ошибки, диалоги,
      Escape/focus, узкий экран и визуальное соответствие старому UI.
- [x] Сохранить пары old/new для одинаковых состояний на телефоне, планшете
      и desktop; исправить различия шрифтов/стилей и передать оба локальных URL
      пользователю вместе с результатами сравнения.

Готовность React-анкет достигнута: проверки подключены к общей локальной команде,
проходят, а React UI вручную принят пользователем. LiveView остаётся только в
legacy-ветке.

### 2. Общие проверки репозитория

- [x] Подключить проверки Go, Elixir, контрактов и инфраструктуры из целевой
      матрицы; исправить найденные проблемы или явно описать ограниченный legacy-долг.
- [x] Зафиксировать ограниченный Credo baseline: `script/check-credo` сверяет
      100 legacy-замечаний с JSON-отчётом Credo и блокирует новые либо неучтённые
      исправленные записи.
- [x] Ввести `script/check` как единую точку входа и отдельные команды сервисов.
- [x] Добавить CI quality для merge requests и default branch; сборка релизных
      образов зависит от успешной проверки. Сама настройка CI не разрешает push.
- [x] Проверять архитектурные границы автоматически, включая запрещённые
      импорты и циклы; тесты доменных правил оставлять на уровне сценариев/домена.
- [x] Добавить golangci-lint, ShellCheck, Hadolint, OpenAPI lint и Compose config
      к локальному quality gate; версии внешних контейнерных инструментов закреплены.
- [x] Подключить browser-сценарии и screenshot-регрессию с воспроизводимыми
      данными/шрифтами/viewport и артефактами сравнения по процедуре тестирования.

Готовность: проверки воспроизводимы локально и в CI, версии зафиксированы,
новые нарушения блокируют прохождение; нет массового отключения правил.

### 3. Организовать целевые каталоги

- [x] Выделить `apps/web` и перенести воркер в `services/youtube-worker`.
- [x] Перенести контракты в `contracts`, конфигурацию запуска — в `deploy`.
- [x] Переместить Phoenix в `apps/phoenix`; сохранены отдача React и same-origin
      сессии на переходный период.
- [x] Обновить пути, локальные команды, Docker, CI и документацию; проверить
      сборки всех затронутых приложений и запуск совместного локального стенда.

Готовность: новое расположение работает без изменения поведения продукта.
Не создавать пустой Go API или общие библиотеки только ради дерева каталогов.

### 4. Переносить React по пользовательским сценариям

- [x] После ручного принятия локально переключить анкеты на React с временным
      LiveView fallback; production-переключение по-прежнему запрещён.
- [x] Зафиксировать авторизованный mutation API редактирования анкеты и фото в
      OpenAPI; React использует same-origin cookie и CSRF token. Phoenix API
      проверяет сессию, ownership, whitelist полей, валидацию и ошибки; есть
      контроллерные тесты для read/update, unknown fields и unauthenticated upload.
- [x] Подтвердить browser-сценарием авторизованные text edit и upload: React
      отправляет same-origin cookie+CSRF запрос Phoenix, который передаёт запись
      единственному opt-in Go writer; итоговая проекция и фото проверены.
- [x] Проверить авторизованный edit/upload в реальном browser flow. Историческая
      RoomLive-форма уже не имела reachable browser-flow до удаления, поэтому
      её не возвращали искусственно для screenshot-сравнения; React editor
      сохраняет её типографику, сетку, focus/loading states и stable IDs, а
      browser-сценарий подтверждает edit, upload и последующую выдачу фото.
- [x] Составить [инвентаризацию](migration_inventory.md) оставшихся экранов и
      зависимостей; переносить по одному. Следующий изолированный React-срез —
      read-only ранги и справка, затем библиотека и галерея как отдельные
      write-контексты.
- [ ] Чат, presence и восстановление сессии оставить до отдельного realtime-этапа.

Готовность каждого среза: старые возможности сохранены, API описан, проверки
проходят, сценарий проверен в браузере и готов для проверки пользователем.

### 5. Основной Go backend по bounded contexts

- [x] Выбрать первым контекстом read-only API анкет.
- [x] Создать `apps/api` со слоями domain/application/adapters, composition root,
      PostgreSQL read adapter, HTTP adapter, healthcheck, golangci-lint, vet,
      build и race-тестами. `script/check-go` проверяет оба Go-модуля.
- [x] Зафиксировать совместимость с Elixir-реализацией контрактным сравнением.
      `script/verify-go-profile-contracts` сверяет живые Phoenix и Go на одной
      локальной БД; `script/verify-go-profile-proxy` поднимает оба временных
      процесса с `PROFILES_GO_API_URL` и подтверждает proxy-маршрут. Проверены
      каталог, search/empty search, clamped, invalid/nested/repeated query
      parameters, detail и not-found.
- [x] Передать Go write-path анкет: token-protected internal endpoints принимают
      partial update и фото; Phoenix сохраняет session/CSRF boundary, затем
      reloads Ecto projection. После удаления legacy RoomLive form пользовательское
      редактирование доступно только через React. `script/verify-go-profile-write`
      проверяет text edit, upload и итоговую проекцию через реальный browser.
- [x] Убрать последний Phoenix `INSERT` в `profiles`: database trigger
      `create_profile_for_registered_user` атомарно provision-ит пустую анкету
      после регистрации не-guest пользователя. Это сохраняет единый transaction
      Accounts и не требует небезопасного HTTP-вызова Go до commit.
- [x] Исключить `profiles` из ручной Phoenix S3 media migration при включённом
      Go writer; это предотвращает обход владения записью, а Go продолжает
      читать legacy DB bytes до отдельной Go-controlled S3 миграции.
- [x] Передать Go read-path фото: API читает database/S3 original и thumbnail,
      а Phoenix сохраняет прежние public URLs как тонкий binary proxy при
      `PROFILES_GO_API_URL`. Browser-сценарий проверяет byte-identical PNG и
      WebP thumbnail после Go upload; оба public media endpoint описаны в
      OpenAPI вместе с cache/not-found/unavailable контрактом.
- [x] Подготовить эксплуатационный контур без включения: Docker target
      `profiles-api`, Compose service с healthcheck и нужными DB/S3/token
      переменными, production CI image build. Локальная Docker-сборка target и
      Compose config проверены 2026-09-22.
- [x] Добавить явный Compose opt-in `deploy/compose.profiles-go.yaml`: он
      связывает Phoenix с `profiles-api` только при отдельном подключении файла
      и обязательном `PROFILE_INTERNAL_TOKEN`; базовый compose по умолчанию
      ничего не переключает.
- [ ] Для каждого следующего контекста описать зависимости, авторизацию,
      владельца данных и миграций, транзакции, события и порядок отката.
- [ ] Переключать маршруты по одному; у каждого переключения один активный
      backend. Для write-сценария сначала согласовать передачу владения данными.

Готовность каждого контекста: совместимое поведение, доменные/интеграционные
тесты, статические проверки, диагностика ошибок и проверенный локальный откат.

### 5.1. Миграция аутентификации и авторизации

Цель — перенести `Accounts` в Go без преждевременного внедрения отдельного
identity-провайдера. Для текущего продукта один сайт, локальные аккаунты,
простые роли и tab-scoped chat-session; самостоятельный IdP добавит отдельную
операционную систему и миграцию credential без подтверждённой потребности.

Статус 2026-09-22: `apps/api` предоставляет Go Accounts application layer и
совместимую проверку `pbkdf2_sha256`, регистрацию и principal с ролями. Старый
React login/register и профили теперь доставляются Go и используют public auth API.
Go-owned browser session, public profile writes и полный React flow проверены
локально. Главная и базовый вход в чат перенесены; следующий шаг — полный UI общей комнаты.

Границы сохраняются:

- `account-session` подтверждает пользователя для сайта и остаётся
  same-origin HTTP-only cookie с CSRF-защитой. Браузер не хранит access/refresh
  token в `localStorage` или `sessionStorage`.
- `chat-session` и гостевая identity не являются account-session. Их lifecycle,
  resume-secret, Presence и правило одной активной вкладки остаются отдельным
  контекстом согласно [session_lifecycle.md](session_lifecycle.md).
- `Accounts` владеет зарегистрированными пользователями, password credentials,
  site-session и назначением ролей. Предметные контексты владеют своими
  проверками ownership: наличие роли не заменяет проверку `user_id` при
  изменении анкеты, альбома, сообщения или другого ресурса.
- Роли `admin` и `emoji_moderator` — малый RBAC-набор. UI может скрывать
  недоступное действие, но Go application layer обязан проверять право в каждом
  write-сценарии. Не вводить policy-engine или relation-based authorization до
  появления реальной модели прав на уровне объектов.

Порядок работ:

- [ ] Описать публичный Go application API `Accounts` и `Principal`: регистрация,
      password login, logout, получение текущего пользователя, назначение и
      проверка ролей. Не передавать HTTP cookie, JWT или SQL-модель в domain.
- [x] Создать Go context `internal/accounts/{domain,application,adapters}` и
      перенести password verifier с совместимостью с существующим форматом
      `pbkdf2_sha256`. Новый хэш-формат и обновление credential допустимы только
      после успешной проверки старого пароля и с явной стратегией rollback.
- [ ] Зафиксировать владельца таблиц `registered_users` и account-session до
      cutover; не допускать постоянной dual-write/dual-auth схемы. Сначала Go
      читает и проходит contract-тесты, затем один выбранный маршрут получает
      Go как единственного владельца записи.
- [x] Реализовать Go-owned opaque account-session: HTTP-only Secure cookie,
      CSRF, logout/revocation и current principal. Не использовать Phoenix BFF.
- [ ] Покрыть browser и integration-тестами регистрацию, неверный пароль,
      logout во второй вкладке, истечение/подделку cookie, CSRF, обычную роль,
      обе административные роли, ownership и сохранение независимого
      chat-session. Запустить `mix precommit` и Go race/static checks.
- [x] Проверить целевой Go+React account/profile flow локально. Phoenix запускается лишь из
      legacy-ветки для сравнения, но не подключается к новому стенду.

OIDC — отложенное, независимое расширение, а не условие переноса `Accounts`:

- [ ] Возвращаться к нему только при подтверждённом кейсе: социальный вход,
      корпоративное SSO, мобильный/сторонний клиент или несколько приложений.
- [ ] Тогда реализовать OIDC **client** за портом `IdentityProvider`: Authorization
      Code + PKCE, проверка `state`, `nonce`, issuer, audience, expiry и подписи
      ID token по JWKS; связать стабильный `issuer + sub` с локальным user id.
- [ ] Не делать это собственным OIDC provider и не внедрять ZITADEL/Ory без
      отдельного решения по эксплуатации, ключам, резервному копированию,
      миграции существующих credentials и требуемым SSO-сценариям.

Готовность: Go владеет `Accounts`, прежние password-login, cookie/CSRF и роли
совместимы, ownership не ослаблен, chat-session не затронута, а OIDC может быть
добавлен без смены публичных product-сценариев.

### 6. Realtime, сессии и завершение

Первоначальный foundation (историческое описание; public transport уже добавлен): `apps/api/internal/chatsessions`.
В нём есть token-protected internal `start`, который создаёт visit и
chat-session в одной PostgreSQL-транзакции и генерирует resume-secret на
сервере. `leave` транзакционно завершает visit, начисляет chat time
зарегистрированному пользователю и сохраняет departure-message; также есть
restore, `connection-lost`, activate и heartbeat touch для session/visit, с
generation fencing; Go учитывает visible/hidden heartbeat windows, reconnect
grace и терминальность явного выхода. Окна берутся из тех же
`CHAT_SESSION_GRACE_SECONDS` и `CHAT_HIDDEN_SESSION_GRACE_SECONDS`, что и у
Phoenix остаётся legacy-реализацией в отдельной ветке. В целевой ветке не
допускаются Phoenix fallback, feature flags или proxy для lifecycle: Go будет
единственным владельцем lifecycle, Presence, visits и сообщений, а React —
единственным UI. Go reaper запускается штатно вместе с Go-сервисом.
Переход guest → registered user также перенесён в Go: identity, visit и
generation обновляются атомарно, а resume-secret ротируется.

- [ ] Инвентаризировать все оставшиеся обязанности Phoenix, включая фоновые
      задачи, админку, интеграции и эксплуатационные команды.
- [ ] Описать и протестировать протокол realtime: auth, reconnect, порядок
      событий, дедупликацию, курсоры, presence и ошибки соединения.
- [ ] Реализовать Go Presence/WebSocket transport, server-issued connection id,
      room snapshot/catch-up и публикацию событий после commit.
- [ ] Перенести React главную, вход/регистрацию, storage/outbox и страницу
      чата на public Go API/WebSocket, сохранив tab-scoped sessionStorage.
- [ ] Проверить нагрузку и отказные сценарии; удалить временные маршруты и
      Phoenix только после замены всех его обязанностей.

Готовность: пользовательские сценарии полностью обслуживаются Go + React,
документация и локальный стенд актуальны. Production-переход планируется
отдельно и требует явного разрешения пользователя.

## Ближайший порядок полного cutover

1. Выполнено локально: Go-owned browser account-session и public auth API; удалены
   переменные `ACCOUNTS_GO_API_URL`/`ACCOUNTS_INTERNAL_TOKEN` из Compose.
2. Выполнено локально: standalone React build и Go static web delivery,
   вход/регистрация/анкеты на public Go API. Главная и формы входа проверены, UI комнаты пока частичный.
3. Довести React UI общей комнаты и оставшиеся действия чата на уже работающем
   Go WebSocket/Presence transport; сравнить его с legacy на трёх viewport.
   Не создавать новые Phoenix routes, controllers или LiveView для этих шагов.
4. Перенести остальные public контексты по тому же правилу и удалить Phoenix
   из Docker/Compose/CI target текущей ветки. Сравнение с Phoenix выполняется
   только отдельным legacy checkout.

## Как продолжать в следующей сессии

1. Прочитать `AGENTS.md`, этот план, целевую архитектуру и правила затронутого
   контекста. Проверить текущую ветку и `git status`; не затирать рабочее дерево.
2. Сопоставить состояние файлов с таблицей выше. Брать первый незавершённый
   этап, не считать описанную в документации проверку уже внедрённой.
3. Следующий этап — UI общей комнаты и оставшиеся возможности чата. Главная,
   guest/registered entrance и базовый public Go WebSocket transport уже работают;
   не возобновлять исторический Phoenix proxy rollout. Для проверки Accounts
   применять `script/verify-go-accounts` на изолированной БД. Для миграции
   существующей схемы перед запуском Accounts есть `apps/api/cmd/migrate`;
   production-запуск этой команды не разрешён.
4. После изменений запускать `cd apps/phoenix && mix precommit`; для Go ранее
   использовались `GO=/tmp/chat-go-sdk/go/bin/go` и `GOCACHE=/tmp/chat-go-cache`.
   Для локального Go ранее использовались `GO=/tmp/chat-go-sdk/go/bin/go` и
   `GOCACHE=/tmp/chat-go-cache`; проверить их наличие, не полагаться на `/tmp`.
5. Текущий сравнительный Go preview — `http://127.0.0.1:4050/`,
   legacy — `http://127.0.0.1:4051/`; fixture01 / secret123.
   Стенд 4040 из прошлой сессии не обновлялся этим этапом. Проверить процессы/health перед использованием;
   старые процессы не обязаны пережить следующую сессию. Команды запуска есть
   в README и отчёте Go web. Стенды используют независимые тестовые БД.
6. Обновить этот план: завершённые пункты, изменённые команды, результаты
   проверок, отчёт сравнения старой/новой версии и точный следующий шаг.
   Не отмечать этап готовым только по коду,
   если его проверки ещё не выполнены.
7. Оставить результат для ручной проверки пользователя. Не коммитить и не
   публиковать без его нового указания.
