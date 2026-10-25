# Проверка лимитов по званию — 25 октября 2026

## Изменение

Отдельный общий лимит для треков хит-парада, статей и фотографий:
1, 2, 3, 5, 8, 12, 18, 25, 35, 50 по десяти существующим званиям.
Суточные квоты статей и фото убраны. Первый материал доступен сразу после
регистрации. Имена/пороги званий и условие одновременного достижения фраз и
часов сохранены. Данные сверх лимита сохраняются и редактируются.

## Среда

Закреплённый Linux Docker `chat-quality:local`, Go 1.27.1, Node 24.8.0,
Playwright 1.57.0/Chromium, PostgreSQL 17. Актуальные исходники скопированы
в изолированный runner, Go binary и React production assets собраны там.
Зависимости проверены `npm ls --depth=0` против текущего package.json.
Тестовые БД независимы от `chat-cutover` и production.

Preview: http://127.0.0.1:4077/help#ranks-title — контейнер
`chat-rank-limits-runner`, БД `chat_rank_limits_20261025` в
`chat-rank-limits-db`, пользователь fixture01 / secret123.

## Результаты

- PASS: Go race unit/HTTP для profiles, gallery, library, musicchart, cmd/api;
  go vet, golangci-lint — 0 issues, gofmt.
- PASS: TestPublicationLimitsPostgres — 10 званий × 3 коллекции, четыре
  конкурентных запроса на последнее место, немедленное повышение лимита,
  50 добавлений в один день, отказ после понижения, сохранность/редактирование.
- PASS: TestCommunityPostgres — 11 сценариев: auth/CSRF, ownership, приватные
  записки, права администрирования, конкурирующие общие квоты и фото-upload.
- PASS: PostgreSQL library reading — серии, реакции, изображения и их
  отдельные технические ограничения.
- PASS: соседние TestPublicChatPostgres: хит-парад/ownership/голоса/комментарии,
  media persistence/replay, отмена запросов, remote gallery/failure recovery.
- PASS: TypeScript, ESLint/React architecture, Prettier, 141 frontend unit,
  генерация всех шести OpenAPI DTO, React build, shellcheck новых/изменённых scripts.
- PASS: основной verifier через `browser/rank-limits-verification.ts`,
  desktop 1440×900, tablet 768×1024, mobile 390×844. Реальные Go/PostgreSQL:
  direct navigation и reload, вход через форму, гостевые ограничения,
  публикация первого материала каждого типа и отображение после reload,
  отказ второго с объяснением, недостаточность одного порога звания,
  повышение до второго звания и публикация второго материала, persistence,
  отсутствие горизонтального overflow и JS ошибок. Ошибка на mobile также
  осмотрена после прокрутки к сообщению. PNG в `functional/`.
- PASS: соседний browser `library-target.ts` — редактор, форматирование,
  обложки/иллюстрации, серии, лайки, личные закладки и ограничения доступа.
- Сравнение макетов: `comparison/metrics.json`, все 42 пары имеют
  **0 изменённых пикселей**. Отдельное заключение дизайнера — `REVIEW.md`.

## Повторение

`script/verify-go-rank-limits` запускается внутри quality Docker с
`COVERAGE_DATABASE_URL`, указывающим на disposable PostgreSQL. Команда
сама создаёт fixture-БД, выполняет целевые PostgreSQL-тесты, собирает web/API,
запускает реальный browser на 4078 и удаляет свою БД/сервер при завершении.
Лог успешного запуска: `verification.log`.

Макеты зафиксированы до UI-изменений: `FROZEN`, `FROZEN-extra`.
`capture.mjs` с `CAPTURE_MODE=current` и `capture-extra.mjs` с
`CAPTURE_MODE=current-extra` используют Docker-served build без DOM-подмены
интерфейса. Визуальные fixtures auth/collections фиксированы отдельно от
реальных функциональных тестов; размеры и состояния указаны в manifests.
`compare.mjs` создаёт side-by-side, overlay и pixel diff.

## Границы

Схема PostgreSQL не менялась. Внешний S3 в production не проверялся;
remote storage покрыто целевыми тестами с controlled server. Лимиты
песен/видео в чате не добавлялись по уточнению пользователя. Технические
лимиты обложек и иллюстраций в статьях не входят в общую квоту публикаций.
Полный `script/check` и прежние визуальные сравнения с макетами, содержащими
удалённый текст фиксированных суточных квот, не запускались. Актуальная
визуальная приёмка этого изменения использует новый frozen-комплект.
Коммиты, push и production не выполнялись.
