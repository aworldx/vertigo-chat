# Проверки Go + React

Запуск: `script/check`. На компьютере требуется только работающий Docker.
Локальные Go, Node, PostgreSQL, Elixir и временные SDK не используются.

Первая сборка загружает Go 1.27.1, Node 24.8.0, Chromium из Playwright lockfile,
ImageMagick, PostgreSQL client и закреплённые линтеры. Последующие запуски
используют слои Docker и отдельный Go build cache. Изменение исходников не
переустанавливает браузер и npm-пакеты; изменение lockfile обновляет зависимости.

Каждый запуск получает свою Docker-сеть, PostgreSQL 17 и runner. Порты не
публикуются, production/dev базы не используются. Секреты и Docker socket не
передаются контейнеру; исходники копируются через `.dockerignore`. Runner и БД
с их томом удаляются при завершении, в том числе при ошибке.

Проверяются DTO, TypeScript, ESLint/границы архитектуры, Prettier, gofmt, vet,
Go race tests, golangci-lint/depguard, unit + PostgreSQL + browser coverage,
сборки frontend, аккаунты, чат/плеер/поиск, Тетрис, разделы сайта, ShellCheck,
Hadolint, OpenAPI и Compose config. Пороги покрытия не снижены.
Лог, итоговые JSON-отчёты покрытия и снимки копируются в `coverage/quality/`
даже при неуспехе тестов. Сырые браузерные данные покрытия не копируются:
они занимают несколько гигабайт и нужны только для агрегации внутри runner.

`script/check-target` — внутренние Linux-шаги образа. Вызов отдельных проверок
на хосте требует самостоятельно установленного окружения; для релиза используйте
`script/check`. Phoenix/LiveView comparisons сохранены только как явно запускаемые
legacy-проверки (`npm --prefix apps/web run test:browser:legacy`).
