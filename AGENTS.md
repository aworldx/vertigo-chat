# AGENTS.md

Краткие правила для изменений Phoenix-приложения `chat`.

## Обязательное

- После изменений запускайте `mix precommit` и исправляйте найденные проблемы.
- Следуйте `docs/architecture.md`: бизнес-правила — в контекстах `Chat`, `ChatWeb` остаётся тонким.
- Для HTTP используйте `Req`; не добавляйте `:httpoison`, `:tesla` или `:httpc`.
- Не затирайте чужие незакоммиченные изменения.

## Phoenix и LiveView

- LiveView-шаблоны начинайте с `<Layouts.app flash={@flash} ...>`; передавайте `current_scope`, если он нужен маршруту.
- Используйте HEEx (`~H`/`.heex`), `<.icon>`, `<.input>` и формы через `to_form` + `<.form for={@form}>`.
- Давайте формам, кнопкам, hook-элементам и stream-контейнерам стабильные уникальные `id`.
- Используйте `push_navigate`/`push_patch`, а не устаревшие `live_redirect`/`live_patch`; избегайте LiveComponent без необходимости.
- Для динамических коллекций применяйте LiveView streams. Контейнер обязан иметь `id` и `phx-update="stream"`; при изменении assign, влияющего на stream-элемент, вставляйте элемент в stream повторно.
- Не управляйте DOM из hook без `phx-update="ignore"`. JS храните в `assets/js` или colocated hooks — не в inline `<script>`.

## Elixir, Ecto и тесты

- Не применяйте `String.to_atom/1` к пользовательскому вводу. Предикаты оканчиваются на `?`.
- Не используйте `changeset[:field]` для структур; для changeset применяйте `Ecto.Changeset.get_field/2`.
- Не принимайте программно заданные поля (например, `user_id`) через `cast`; preload-ите ассоциации, используемые в шаблоне.
- Создавайте миграции через `mix ecto.gen.migration имя_в_snake_case`.
- В тестах запускайте процессы через `start_supervised!/1`; не синхронизируйтесь через `Process.sleep/1`.
- Тестируйте LiveView через `Phoenix.LiveViewTest` и селекторы с ключевыми `id`, проверяя поведение, а не сырой HTML.

## UI и CSS

- Используйте Tailwind и собственные CSS-правила; не используйте daisyUI и `@apply`.
- Сохраняйте Tailwind v4 `@import "tailwindcss" source(none)` и `@source` в `assets/css/app.css`.
- Не подключайте vendor-скрипты или стили напрямую из layout; импортируйте их в `app.js`/`app.css`.
- Поддерживайте адаптивность, выверенные отступы, типографику, состояния hover/loading и доступность.
