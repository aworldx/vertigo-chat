# Release 0.24.2 — 2026-10-08

Пользователь явно разрешил commit, production и выпуск всего накопленного.
База: production 0.24.1, 873b3ba7a17035cc65454f64be0c207ba861c654.
Включены отключение Клэр/фоновых диалогов/AI Summary, удаление legacy
Phoenix/LiveView, адаптация React проверок, стилей и документации.
Геоигра и остальные рабочие функции сохранены. Новых миграций нет.
Артефакты, уже сохранённые в origin/main, сохранены и в релизе.

Целевые Linux Docker проверки:
- Go race: cmd/api, bot, chatsessions, rooms, accounts, chatlans, profiles,
  webdelivery и geo HTTP; go vet, golangci-lint всех Go пакетов: 0 issues.
- PostgreSQL: TestPublicChatPostgres; TestAccountsPostgres на отдельных БД.
- TypeScript, весь ESLint/architecture, 141 React unit tests, production build,
  целевой Prettier и Compose config.
- Полный текущий verify-go-chat: вход, регистрация, resume/reload, две вкладки,
  outbox/offline, приватность, модерация, плеер, выход.
- verify-go-accounts: регистрация, cookie/CSRF, login/logout, профиль и фото.
- verify-target-web: галерея/lightbox/подписи, библиотека/редактор, админка,
  импорты, целевое сравнение 1440/768/390.
- Финальный основной verifier точной сборки полного релиза: /history гостя
  и аккаунта, reload, поиск, нет Summary, API 503; /chat 1440×900 и 390×844,
  reload, Хичкок присутствует, Клэр отсутствует, отправка; /help.
- История пиксельно совпала с исходными макетами на обоих размерах (0 отличий).
  Финальный review: release-review.md. PNG и полные логи сохранены локально.

Проверки выполнялись в закреплённом chat-quality:local с точным снимком
релизного дерева; package-lock.json идентичен закреплённому окружению.
Отдельная пересборка инструментария была остановлена после сетевой задержки
загрузки Chromium — для проверок использован уже готовый тот же инструментарий.

Резервная копия production:
 /opt/backups/vertigo-chat/disable-ai-0.24.2-20261008T085258Z
postgres.dump: 524494 bytes; pg_restore --list: 355 строк, проверено.
Сохранены .env и .env.vps с закрытыми правами.
Rollback API: api-873b3ba7a17035cc65454f64be0c207ba861c654.
Публикация: GitLab CI, образ точного SHA, script/deploy-production api.

Полный script/check, live OpenAI, Safari/Firefox не запускались.
Новых игровых правил нет; живая Google-партия в production не запускалась.
