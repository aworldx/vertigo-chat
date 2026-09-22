# План переезда на Go + React

Обновлено: 2026-09-22. Рабочая ветка: `codex/go-react-migration`.
Это точка продолжения для следующих сессий. Архитектурные требования и целевое
дерево каталогов находятся в [refactoring_target.md](refactoring_target.md).
Обязательная процедура проверки каждого среза — в
[migration_testing.md](migration_testing.md): параллельный локальный запуск
старой и новой версий, функциональное и визуальное сравнение, отчёт для пользователя.

## Цель и ограничения

Постепенно заменить интерфейс на React + строгий TypeScript, а основной бэкенд
на Go, сохраняя работающий продукт на каждом шаге. Всё остаётся в одной монорепе.
Phoenix поддерживает ещё не перенесённые сценарии до их проверенной замены.

- Работать в отдельной ветке миграции `codex/go-react-migration` до полного
  завершения миграции; не переносить изменения в main автоматически.
- Пользователь разрешил локально переключить `/profiles` на React при сохранении
  LiveView fallback; это не разрешение на production.
- До полного завершения миграции не делать production rollout: не выполнять
  push, публикацию образов, деплой или изменения production. Разрешены только
  коммиты в текущую ветку и проверка локальных стендов.
- Сохранять внешний вид, особенно шрифты, отступы и поведение диалогов.
  Смена технологии сама по себе не является задачей редизайна.
- Не переписывать UI и backend одного сценария одновременно: сначала закрепить
  контракт, затем перенести UI, затем заменить backend за тем же контрактом.
- Один владелец записи и миграций на область данных; без dual write.

## Текущее состояние

| Часть | Сделано | Ещё не сделано |
| --- | --- | --- |
| YouTube worker | Переписан на Go и расположен в `services/youtube-worker`; поиск, подготовка, кэш, proxy/range; отдельная сборка Docker; golangci-lint, `gofmt`, `go vet`, race-тесты | Полный production Docker build проверяется в CI quality/build pipeline |
| React-анкеты | Локальный `/profiles` отдаёт React; `/profiles/live` сохраняет временный LiveView fallback, `/profiles/react` — React alias. Строгий TypeScript, browser/visual-сравнение и ручное принятие завершены | Production-переключение запрещено до полного завершения всей миграции |
| API анкет | `apps/api` реализует Go read/write-модель анкет с domain/application/PostgreSQL/HTTP слоями, healthcheck, unit/race-тестами и тем же публичным контрактом. Phoenix имеет обратимые opt-in proxy: `PROFILES_GO_API_URL` для public JSON и media read, `PROFILES_GO_WRITE_API_URL` + `PROFILE_INTERNAL_TOKEN` для единого write-пути. React edit/upload и выдача original/thumbnail через cookie+CSRF Phoenix и Go подтверждены browser-сценарием | Включить оба proxy только после ручного принятия локального стенда; production-включение запрещено до полного завершения всей миграции |
| Основной backend | Phoenix/Elixir, существующие контексты и тесты | Миграция предметных областей на Go ещё не начата |
| Архитектура | `apps/phoenix`, `apps/web`, `apps/api`, `services/youtube-worker`, `contracts`, `deploy`; quality gates и матрица проверок работают. Docker target и Compose service `profiles-api` готовы и проверены локальной сборкой | Phoenix сохраняется временным application host; production rollout не выполнялся |

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

Готовность достигнута: проверки подключены к общей локальной команде, проходят,
а React-анкеты вручную приняты пользователем. Временный LiveView fallback сохраняется.

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

### 6. Realtime, сессии и завершение

- [ ] Инвентаризировать все оставшиеся обязанности Phoenix, включая фоновые
      задачи, админку, интеграции и эксплуатационные команды.
- [ ] Описать и протестировать протокол realtime: auth, reconnect, порядок
      событий, дедупликацию, курсоры, presence и ошибки соединения.
- [ ] Использовать [session_lifecycle.md](session_lifecycle.md) и
      [chat_antipatterns.md](chat_antipatterns.md); перенести backend и UI
      отдельными совместимыми шагами.
- [ ] Проверить нагрузку и отказные сценарии; удалить временные маршруты и
      Phoenix только после замены всех его обязанностей.

Готовность: пользовательские сценарии полностью обслуживаются Go + React,
документация и локальный стенд актуальны. Production-переход планируется
отдельно и требует явного разрешения пользователя.

## Как продолжать в следующей сессии

1. Прочитать `AGENTS.md`, этот план, целевую архитектуру и правила затронутого
   контекста. Проверить текущую ветку и `git status`; не затирать рабочее дерево.
2. Сопоставить состояние файлов с таблицей выше. Брать первый незавершённый
   этап, не считать описанную в документации проверку уже внедрённой.
3. Read-контракт и обратимый Phoenix → Go proxy проверены на локальном стенде:
   `DATABASE_URL=... GO=... script/verify-go-profile-contracts` (оба API уже
   запущены) либо `script/verify-go-profile-proxy` (поднимает оба временно).
   Go уже имеет закрытый token-protected mutation endpoint для partial field
   updates и фото с ImageMagick WebP thumbnail, с атомарным ownership по
   `user_id`. Go S3 adapter повторяет SigV4, object keys и public-read verify;
   его local HTTP integration test проверяет подпись, upload и exact-byte read.
   При opt-in write flag Phoenix JSON editor использует Go как единственного
   writer. `script/verify-go-profile-write` создаёт и удаляет временный
   локальный аккаунт, проходит через cookie+CSRF Phoenix и подтверждает update
   в Go на итоговой проекции. Browser-часть этого скрипта подтверждает React
   editor text edit и валидный PNG upload через Go, а также выдачу исходного
   PNG и WebP thumbnail через Go. Недостижимая RoomLive
   форма, upload и handlers удалены; его edit control ведёт в React `/profiles`.
   Docker target и Compose service `profiles-api` готовы, но все Go proxy flags
   по умолчанию выключены. Для совместного Compose-стенда подключать
   `-f deploy/compose.profiles-go.yaml` и передавать непустой
   `PROFILE_INTERNAL_TOKEN`; базовый compose не менять. Следующий этап — поднять совместный локальный стенд
   с Go read/write flags, повторить browser-сравнение авторизованного просмотра
   с историческим базовым снимком на изолированной БД. Не готовить production
   rollout до полного завершения всей миграции.
4. После изменений запускать `cd apps/phoenix && mix precommit`; для Go ранее
   использовались `GO=/tmp/chat-go-sdk/go/bin/go` и `GOCACHE=/tmp/chat-go-cache`.
   Для локального Go ранее использовались `GO=/tmp/chat-go-sdk/go/bin/go` и
   `GOCACHE=/tmp/chat-go-cache`; проверить их наличие, не полагаться на `/tmp`.
5. Для браузера ранее использовался `http://localhost:4030/profiles/react`,
   YouTube worker — порт 4021. Проверить процессы/health перед использованием;
   старые процессы не обязаны пережить следующую сессию. Команды запуска есть
   в документации миграции и README. Локальные стенды используют общую dev-БД.
6. Обновить этот план: завершённые пункты, изменённые команды, результаты
   проверок, отчёт сравнения старой/новой версии и точный следующий шаг.
   Не отмечать этап готовым только по коду,
   если его проверки ещё не выполнены.
7. Оставить результат для ручной проверки пользователя. Не коммитить и не
   публиковать без его нового указания.
