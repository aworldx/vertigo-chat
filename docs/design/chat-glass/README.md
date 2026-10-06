# Vertigo Glass

Готовая локальная тема: «Настройки → Интерфейс → Vertigo · Стекло». Основной просмотр — [mock.html](mock.html), актуальные снимки — [actual-final](actual-final), полный отчёт и сравнения — [REVIEW.md](REVIEW.md).

Выбранный пользователем дизайн: спокойная общая подложка для текста, приглушённые внешние рамки, компактные служебные события/опрос и стройный чёрный Кармик. Фон — `apps/web/public/images/vertigo-glass-evening-v2.png`; кот — `apps/web/public/images/karmik-black-concept-v1.png`. Production не обновлён.

История: `concept-initial.html` сохраняет ранний упрощённый HTML-концепт. `mock-reading` и `mock-black-cat` — показанные пользователю предложения; `mock-final` — замороженные до реализации эталоны пяти viewport и пяти состояний. `FINAL-FROZEN.sha256` защищает эталоны от перезаписи.

Проверка: Docker Chromium, маршрут /chat, точные fixture/auth/viewport описаны в REVIEW.md и capture-final.mjs. Функциональный тест — apps/web/browser/glass-verification.ts; визуальная сверка — compare-final.mjs. Не обновлять mock PNG для устранения расхождений реализации.
