# Проверка главной

Основной агент применил skill `verifier` после реализации. Закреплённый
Linux runner `chat-quality:local`, текущие исходники web/API, изолированный
PostgreSQL 17 с `legacy-schema.sql`, `go-web.sql` и актуальными Go-миграциями.
API доступен на `http://127.0.0.1:4097`; реальные HTTP/WebSocket, без моков API.

## Результаты

- `npm run typecheck` — PASS.
- Целевой ESLint, Prettier и `scripts/check-architecture.mjs` — PASS.
- `node --import=tsx --test test/chat-help.test.tsx` — 3 PASS.
- `npm run build` — PASS.
- `go test -race ./internal/webdelivery ./internal/entrance/... ./internal/accounts/adapters/postgres` — PASS;
  аккаунты проверены на отдельной `chat_accounts_test_landing` базе со схемой fixture.
- `node --import=tsx browser/landing-verification.ts http://127.0.0.1:4097` — PASS:
  desktop 1440×900, tablet 768×1024, mobile 390×844. Прямой вход на `/`, refresh,
  отсутствие старых игр, отсутствие горизонтального overflow. Нажаты все 12
  карточек каталога, 2 ссылки игр, ссылка рейтингов. HTTP 200, верные адреса,
  существующие темы справки с раскрытием. Переключение регистрации/входа,
  вход без пароля гостем, отправка сообщения и выход — PASS на всех размерах.
  Browser page errors отсутствуют.
- `capture.mjs current` после browser-проверки; `compare.mjs` — 12 пар с нулевыми
  отличиями, включая полную страницу и top/middle/bottom. Основной агент
  просмотрел актуальные PNG всех трёх размеров и мобильные scroll-кадры.

Ранние попытки typecheck выявили устаревшие файлы из Docker image overlay;
директории тестов и исходников заменены точной копией текущей ветки.
Исправлена явная TypeScript-аннотация URL в новом browser-сценарии.
После исправлений проверки повторены и завершились успешно.

## Охват и ограничения

Описание сверено с `chatHelp.ts`, `chatCommands.ts`, маршрутами Go/React и формой
входа. Действия игр и интеграции медиа не менялись и заново целиком не проверялись.
Условие подключения Google Maps указано явно. Внешние API и production не
использовались. Тестируется описание и переходы главной с соседним сценарием входа.
Макеты заморожены до реализации; визуальный вердикт дизайнера — в `REVIEW.md`.
