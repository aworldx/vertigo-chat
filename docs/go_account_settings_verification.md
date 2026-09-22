# Настройки аккаунта: Go + React

Дата: 2026-09-23. Ветка `codex/go-react-migration`, локальные изменения
поверх `2dcb146`. Без commit/push/production. Эталон:
`0734268bd59a6a84178d3040fefd805e707ff6cb`,
`/private/tmp/chat-web-legacy-0734268`.

## Перенесённый сценарий

`/account` читает и сохраняет приватный email для форума.
`GET /api/v1/account/settings` возвращает email только текущему аккаунту;
`PUT /api/v1/account/settings/email` принимает только `email`.
Actor определяется account-cookie; запись защищена CSRF и same-origin.
Ответы имеют `Cache-Control: no-store`. Публичные DTO не расширялись email.
Отправки писем и обращения к форуму нет.

Правила находятся в Accounts domain/application, PostgreSQL-адаптер читает
и обновляет только `registered_users.email` своего пользователя.
Сохраняются trim/lowercase, проверка формата и существующий уникальный индекс
`registered_users_lower_email_index`. Конкурентный конфликт не меняет адрес.
Пароль, роль, настройки чата и чужие данные не обновляются.
Go Accounts остаётся единственным владельцем записи в целевой реализации;
новых таблиц и миграций нет. Phoenix-код не изменён.

React разделён на API, hook загрузки/сохранения и UI. Используются
генерируемые OpenAPI-типы, strict TypeScript и публичный API features.
Смена аккаунта размонтирует форму; запросы отменяются при размонтировании.
Параллельные submit блокируются синхронно. Сетевой отказ сохраняет ввод
и допускает повтор. При серверной ошибке email поле показывает нормализованный
адрес, как changeset legacy. Сохранение и reload читают ответ Go/БД.

## Явные отличия поведения

- Гость получает существующую React-форму входа прямо на `/account`;
  успешный вход возвращает настройки в том же URL. Legacy отправляет гостя
  в `/library`, которая ещё не перенесена. Phoenix fallback не используется.
- Максимум 254 символа проверяется также Go API. Legacy ограничивал это
  только атрибутом `maxlength` в UI.
- Уведомление об успехе закрывается доступной кнопкой; в legacy кликабельна
  вся плашка. Внешний вид уведомления сохранён.
- Оригинальные английские тексты ошибок Ecto сохранены для визуальной
  совместимости. Сетевые ошибки/истёкшая сессия имеют отдельные сообщения.

Игры, библиотека и форумный SSO не перенесены этим этапом.

## Стенды и воспроизведение

```sh
PATH=/private/tmp/chat-go-sdk/go/bin:/private/tmp/chat-migration-tools:$PATH \
LEGACY_ROOT=/private/tmp/chat-web-legacy-0734268 \
WEB_VERIFICATION_SUITE=account-settings \
GO_WEB_PORT=4098 LEGACY_WEB_PORT=4099 \
KEEP_MIGRATION_STAND=1 script/verify-go-web
```

Go: <http://127.0.0.1:4098/account>.
Legacy: <http://127.0.0.1:4099/account>.
Вход: `fixture01` / `secret123`. Для входа через интерфейс legacy удобно
использовать главную: зарегистрированный вход в чат, затем перейти на `/account`.
Автотест подключает существующий legacy `account_login.js`, отсутствующий
в root layout pinned checkout, как предыдущие verification suites.

БД отдельные, одинаковые fixtures: `chat_web_go_24459`,
`chat_web_legacy_24459`. State directory:
`/var/folders/lx/sp3m_f093dl7m34dwt1_695r0000gn/T/chat-web-verification.paMrig`.
Go assets скопированы в отдельный каталог стенда.
После исправлений browser runner на этих стендах завершился с кодом 0.

## Результаты

- 35 full-page old/new/diff пар: 7 состояний × 5 viewport.
  Ширины 390, 639, 640, 768, 1440; высоты соответственно 844, 900,
  900, 1024, 900. Проверены пустая форма, focus, required, invalid format,
  case-insensitive duplicate, success flash и reload.
  Все 35 pixel-exact, без масок, CSS overrides и допуска.
  CSS-переходы завершаются одинаковым `animations: disabled`.
- Дополнительно проверены текст, метрики/шрифты элементов, отсутствие
  horizontal overflow и результат записи в обеих независимых БД.
  Снимки и JSON: `apps/web/migration-results/account-settings/`.
- Go unit: формат/длина/нормализация, anonymous/revoked session,
  CSRF/origin/host/fetch-site, подмена user_id/роли, malformed/null payload,
  no-store и безопасные HTTP-ошибки.
- PostgreSQL: два конкурентных владельца одного email, конфликт без записи,
  повтор того же адреса, неизменность password hash, отсутствие доступа
  к несуществующему/игровому гостевому аккаунту.
- `script/verify-go-accounts`: real browser проверяет login на `/account`,
  сохранение/reload, отсутствие email в публичной анкете, CSRF/extra fields,
  ограничение длины, pending/один submit, network error/retry,
  load error/retry, выход в другой вкладке и закрытие приватной формы.
  Сценарий подключён к существующему Accounts verification entry point.

Итоговый `mix precommit` завершился с кодом 0: 411 ExUnit, 15 frontend,
3 browser, Go lint/vet/race/build, strict TypeScript/ESLint/Prettier,
Credo/Dialyzer и генерация контрактов. Повторный финальный
`verify-go-accounts` также завершился с кодом 0.
Первоначальные замечания gocyclo исправлены разделением тестов по сценариям,
без подавления линтера.
Ручное принятие пользователем ещё не получено.
