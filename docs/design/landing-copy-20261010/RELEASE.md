# Release 0.24.3 — 2026-10-10

Пользователь разрешил выпуск обоих исправлений: файл Search Console и актуальное
описание главной. Новый API image содержит Go-обработчик и собранный React.
Новых миграций, изменений контрактов и зависимостей нет. YouTube worker не меняется.

## Проверки перед push и production

Все перечисленные проверки повторены на точной копии релизных исходников
в Linux Docker, успешно:

- Go race: webdelivery, entrance (HTTP/application), accounts PostgreSQL.
- `go vet` и golangci-lint: webdelivery и entrance; gofmt webdelivery.
- TypeScript, целевой ESLint/Prettier, React architecture.
- 3 теста общего каталога помощи и web production build.
- Файл Google совпадает побайтно в public/dist; HTTP-тесты GET/HEAD,
  неизвестного файла и вложенного пути. Chromium: прямой вход, reload,
  HTTP 200 и точное исходное содержимое без авторизации.
- Основной verifier: главная с refresh, все ссылки карточек и игр,
  раскрытие адресных инструкций, переключение регистрации, гостевой вход,
  отправка сообщения, выход на 1440×900, 768×1024, 390×844.
- 12 сравнений release PNG с замороженными макетами: changed=0, max=0.
  Артефакты этого повторного запуска: `coverage/quality/landing-release/`.
  Первоначальные макеты и принятый строгий review сохранены в этой папке.

Сборка нового quality-образа остановлена из-за задержки загрузки Chromium.
Использован готовый `chat-quality:local` с точной копией исходников.
Совпадение package-lock проверено SHA-256:
`4b110c2447919f39e9f310d83a936a09d60cc9d4e6b4bf10be3e52a5217d8486`.
Go 1.27.1, Node 24.8.0, Playwright 1.57.0 соответствуют закреплённым версиям.
Chromium используется только для проверок, в production API image не входит.

## Production и откат

До выпуска публичный адрес файла Google возвращал 404.
Production и обе удалённые main исходно на
`bdbd84da19dafc4ec8a0b0011c9cd8fc57d82f49` (0.24.2), checkout чистый.
Резервная копия: `/opt/backups/vertigo-chat/landing-0.24.3-20261010T101317Z`.
Дамп 558246 байт, `pg_restore --list` успешно прочитан (355 строк).
Конфигурация сохранена с закрытыми правами; rollback API image:
`api-bdbd84da19dafc4ec8a0b0011c9cd8fc57d82f49`.
Публикация: GitLab image точного SHA и `script/deploy-production api`.

Полный `script/check`, live-медиа, OpenAI, Google Maps и другие браузеры не
запускались: их поведение не менялось. Подтверждение собственности в самой
Search Console выполняется пользователем после доступности файла на сайте.
