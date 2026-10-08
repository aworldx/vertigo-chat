# Проверка отключения AI-функций — 2026-10-08

Основной агент использовал skill verifier. Закреплённый Linux Docker образ
chat-quality:local, отдельный контейнер chat-bots-check и PostgreSQL 17
chat-bots-db. Production и существующие локальные стеки не менялись.

Проверено:
- Go race unit/HTTP: cmd/api, bot, chatsessions, rooms; vet и golangci-lint (0 issues).
- TestPublicChatPostgres на новой базе bots_final с legacy-schema.sql и go-web.sql: PASS.
- React TypeScript, целевой ESLint и Prettier; 15 тестов history/help/online; build: PASS.
- /history: прямой переход и reload гостя и fixture07, отсутствие кнопки Summary,
  поиск по автору с пустым результатом, POST summary возвращает 503 summary_unavailable.
- /chat: вход гостя и reload, Хичкок есть, Клэр отсутствует, обычная отправка
  «Клэр, привет» отображается в чате; desktop 1440×900 и mobile 390×844.
- /help: инструкции явно сообщают об отключении Клэр/диалогов/Summary.
- PNG обоих маршрутов лично просмотрены основным агентом.

Сценарий: verify.mts, снимки: history-*-actual.png, chat-*-actual.png.
Для истории guest, locale ru-RU, timezone Europe/Moscow, fixed clock
2026-10-08T09:00:00Z, DPR=1; макеты созданы до реализации.
Дизайнерский review хранится отдельно.

Первые попытки PostgreSQL запуска не прошли из-за отсутствующих fixtures,
затем повторного использования загрязнённой тестовой БД. Окончательный
прогон выполнен на новой базе с полным набором fixtures и прошёл.
Первый typecheck использовал старые удалённые browser/test файлы из образа;
после точной синхронизации текущего дерева typecheck прошёл.

Не проверены живой OpenAI, Safari/Firefox; полный script/check не запускался.
Не было commit, push или production deployment.
