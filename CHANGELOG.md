# История изменений

Этот файл ведётся по принципам [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/) и
[Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

## [0.2.0] — 2026-09-10

### Исправлено

- После reconnect контейнер сообщений возвращается из `phx-update="ignore"` в stream-режим
  до синхронизации пропущенных сообщений. Подтверждённые сервером сообщения больше не остаются
  локальными пунктирными карточками с одной галочкой.
- Ответ Хичкока продолжает выполняться в серверном supervisor, если LiveView отправителя
  переподключился.
- Пустой ответ OpenAI повторяется один раз; при повторной пустоте Хичкок публикует понятную
  резервную реплику вместо молчания.
- Ошибки ответов Хичкока записываются в production-лог без пользовательского текста.

### Изменено

- Добавлены changelog, semantic versioning и release-теги Git.

[Unreleased]: https://github.com/aworldx/vertigo-chat/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/aworldx/vertigo-chat/compare/365c134...v0.2.0
