<!-- Назначение файла: рабочие правила для Codex/агентов при изменении этого Phoenix-проекта. -->

Это веб-приложение, написанное с использованием фреймворка Phoenix.

## Правила проекта

- После завершения всех изменений запускайте alias `mix precommit` и исправляйте все обнаруженные проблемы.
- Следуйте архитектурным соглашениям из `docs/architecture.md`; сохраняйте слой `ChatWeb` тонким, а продуктовые правила размещайте в Phoenix-контекстах внутри `Chat`.
- Для HTTP-запросов используйте уже подключённую библиотеку `:req` (`Req`), **избегайте** `:httpoison`, `:tesla` и `:httpc`. Req подключена по умолчанию и является предпочтительным HTTP-клиентом для Phoenix.

### Правила Phoenix v1.8

- **Всегда** начинайте LiveView-шаблоны с `<Layouts.app flash={@flash} ...>`, оборачивающего всё внутреннее содержимое.
- Модуль `MyAppWeb.Layouts` уже имеет alias в `my_app_web.ex`, поэтому повторно объявлять его не нужно.
- При ошибке об отсутствующем assign `current_scope`:
  - либо не соблюдены правила аутентифицированных маршрутов, либо `current_scope` не передан в `<Layouts.app>`;
  - **всегда** исправляйте её переносом маршрутов в правильный `live_session` и передачей `current_scope` там, где это необходимо.
- В Phoenix v1.8 компонент `<.flash_group>` перенесён в `Layouts`. **Запрещено** вызывать `<.flash_group>` вне `layouts.ex`.
- `core_components.ex` по умолчанию импортирует `<.icon name="hero-x-mark" class="w-5 h-5"/>`. **Всегда** используйте `<.icon>` и **никогда** не используйте модули `Heroicons` или аналоги.
- **Всегда** используйте импортированный `<.input>` из `core_components.ex`, когда он подходит для поля формы.
- При переопределении стандартных классов (`<.input class="myclass px-2 py-1 rounded-lg">`) они не наследуются, поэтому собственные классы должны полностью оформлять поле.

### Правила JS и CSS

- **Используйте классы Tailwind CSS и собственные CSS-правила** для аккуратных, адаптивных и выразительных интерфейсов.
- Tailwind CSS v4 **больше не требует `tailwind.config.js`** и использует новый синтаксис в `app.css`:

      @import "tailwindcss" source(none);
      @source "../css";
      @source "../js";
      @source "../../lib/my_app_web";

- **Всегда используйте и сохраняйте этот синтаксис импорта** в `app.css` проектов, созданных через `phx.new`.
- **Никогда** не используйте `@apply` в обычном CSS.
- **Всегда** создавайте собственные Tailwind-компоненты вместо daisyUI, чтобы дизайн оставался уникальным и высококачественным.
- По умолчанию поддерживаются **только сборки app.js и app.css**:
  - нельзя подключать внешние vendor-скрипты через `src` или стили через `href` в layouts;
  - vendor-зависимости нужно импортировать в `app.js` и `app.css`;
  - **никогда не добавляйте inline-теги `<script>custom js</script>` в шаблоны**.

### Правила UI/UX и дизайна

- **Создавайте интерфейсы мирового уровня**, уделяя внимание удобству, эстетике и современным принципам дизайна.
- Реализуйте **ненавязчивые микроинтеракции**: hover-эффекты кнопок, плавные переходы и подобные детали.
- Обеспечивайте **чистую типографику, выверенные отступы и сбалансированную компоновку** для премиального вида.
- Уделяйте внимание **приятным деталям**: hover-эффектам, состояниям загрузки и плавным переходам между страницами.

<!-- usage-rules-start -->

<!-- phoenix:elixir-start -->
## Правила Elixir

- Списки Elixir **не поддерживают доступ по индексу через синтаксис Access**.

  **Никогда не делайте так (неверно)**:

      i = 0
      mylist = ["blue", "green"]
      mylist[i]

  Для доступа по индексу **всегда** используйте `Enum.at`, сопоставление с образцом или функции `List`:

      i = 0
      mylist = ["blue", "green"]
      Enum.at(mylist, i)

- Переменные Elixir неизменяемы, но могут быть повторно связаны. Для `if`, `case`, `cond` и подобных блоков результат *необходимо* присвоить переменной, если он нужен далее. НЕЛЬЗЯ повторно связывать нужный результат только внутри блока:

      # НЕВЕРНО: результат внутри `if` никуда не присваивается
      if connected?(socket) do
        socket = assign(socket, :val, val)
      end

      # ВЕРНО: результат `if` связывается с переменной
      socket =
        if connected?(socket) do
          assign(socket, :val, val)
        end

- **Никогда** не размещайте несколько вложенных модулей в одном файле: это может вызвать циклические зависимости и ошибки компиляции.
- **Никогда** не используйте `changeset[:field]` для структур: они по умолчанию не реализуют Access. Читайте поля напрямую (`my_struct.field`) или через высокоуровневый API, например `Ecto.Changeset.get_field/2` для changeset.
- Стандартная библиотека Elixir содержит всё необходимое для дат и времени. При необходимости изучайте `Time`, `Date`, `DateTime` и `Calendar`. **Никогда** не устанавливайте дополнительные зависимости для дат без запроса; исключение — парсинг дат, где можно использовать `date_time_parser`.
- Не применяйте `String.to_atom/1` к пользовательскому вводу: это создаёт риск утечки памяти.
- Имена предикатов не должны начинаться с `is_` и должны заканчиваться `?`. Имена вида `is_thing` оставляйте для guard-функций.
- OTP-примитивы `DynamicSupervisor` и `Registry` требуют имени в child spec: `{DynamicSupervisor, name: MyApp.MyDynamicSup}`. После этого используйте `DynamicSupervisor.start_child(MyApp.MyDynamicSup, child_spec)`.
- Для конкурентного перебора с обратным давлением используйте `Task.async_stream(collection, callback, options)`. Обычно следует передавать `timeout: :infinity`.

## Правила Mix

- Перед задачей изучайте документацию и опции через `mix help task_name`.
- Для отладки запускайте конкретный файл: `mix test test/my_test.exs`, либо ранее упавшие тесты: `mix test --failed`.
- `mix deps.clean --all` нужен **крайне редко**. **Не используйте** его без веской причины.

## Правила тестирования

- Для процессов в тестах **всегда используйте `start_supervised!/1`**: он гарантирует очистку между тестами.
- **Избегайте** `Process.sleep/1` и `Process.alive?/1`:
  - вместо sleep при ожидании завершения **всегда** используйте `Process.monitor/1` и проверяйте DOWN:

      ref = Process.monitor(pid)
      assert_receive {:DOWN, ^ref, :process, ^pid, :normal}

  - вместо sleep для синхронизации **всегда** используйте `_ = :sys.get_state/1`, чтобы убедиться, что предыдущие сообщения обработаны.
<!-- phoenix:elixir-end -->

<!-- phoenix:phoenix-start -->
## Правила Phoenix

- Блоки router `scope` могут содержать alias, добавляемый ко всем маршрутам внутри scope. **Всегда** учитывайте это, чтобы не получить повторные префиксы модулей.
- Для маршрутов **никогда** не нужен собственный `alias`: его предоставляет `scope`:

      scope "/admin", AppWeb.Admin do
        pipe_through :browser

        live "/users", UserLive, :index
      end

  Маршрут UserLive будет указывать на `AppWeb.Admin.UserLive`.

- `Phoenix.View` больше не нужен и не входит в Phoenix — не используйте его.
<!-- phoenix:phoenix-end -->

<!-- phoenix:ecto-start -->
## Правила Ecto

- **Всегда** preload-ите Ecto-ассоциации в запросах, если они используются в шаблоне, например для `message.user.email`.
- При написании `seeds.exs` не забывайте `import Ecto.Query` и другие нужные модули.
- Поля `Ecto.Schema` всегда используют тип `:string`, в том числе для колонок `:text`: `field :name, :string`.
- `Ecto.Changeset.validate_number/2` **НЕ ПОДДЕРЖИВАЕТ `:allow_nil`**. Проверки Ecto и так выполняются только при наличии ненулевого изменения поля.
- Для полей changeset **необходимо** использовать `Ecto.Changeset.get_field(changeset, :field)`.
- Поля, задаваемые программно, например `user_id`, нельзя включать в `cast` из соображений безопасности. Устанавливайте их явно при создании структуры.
- Для миграций **всегда** вызывайте `mix ecto.gen.migration migration_name_using_underscores`, чтобы соблюсти временные метки и соглашения.
<!-- phoenix:ecto-end -->

<!-- phoenix:html-start -->
## Правила Phoenix HTML

- Шаблоны Phoenix **всегда** используют `~H` или `.html.heex` (HEEx), **никогда** не используйте `~E`.
- Для форм **всегда** используйте импортированные `Phoenix.Component.form/1` и `Phoenix.Component.inputs_for/1`. **Никогда** не используйте устаревшие `Phoenix.HTML.form_for` и `Phoenix.HTML.inputs_for`.
- **Всегда** используйте `Phoenix.Component.to_form/2`: `assign(socket, form: to_form(...))` и `<.form for={@form} id="msg-form">`. В шаблоне обращайтесь к полям через `@form[:field]`.
- **Всегда** добавляйте уникальные DOM ID ключевым элементам: формам, кнопкам и т. п. Их затем можно использовать в тестах: `<.form for={@form} id="product-form">`.
- Общие импорты шаблонов добавляйте через import/alias в `html_helpers` файла `my_app_web.ex`. Они будут доступны LiveView, LiveComponent и модулям с `use MyAppWeb, :html` (замените `my_app` настоящим именем).
- Elixir поддерживает `if/else`, но **НЕ поддерживает `if/else if` или `if/elsif`**. **Никогда не используйте `else if` или `elseif`**, применяйте `cond` или `case`.

  **Никогда не делайте так (неверно)**:

      <%= if condition do %>
        ...
      <% else if other_condition %>
        ...
      <% end %>

  Вместо этого **всегда** делайте так:

      <%= cond do %>
        <% condition -> %>
          ...
        <% condition2 -> %>
          ...
        <% true -> %>
          ...
      <% end %>

- Для литеральных `{` или `}` HEEx требует специальной аннотации. Чтобы показать код в `<pre>` или `<code>`, *необходимо* добавить `phx-no-curly-interpolation`:

      <code phx-no-curly-interpolation>
        let obj = {key: "val"}
      </code>

  В таком теге скобки не нужно экранировать, а динамические выражения по-прежнему доступны через `<%= ... %>`.
- Атрибуты class в HEEx поддерживают списки, но **всегда** используйте `[...]`. Для нескольких и условных классов делайте так:

      <a class={[
        "px-2 text-white",
        @some_flag && "py-5",
        if(@other_condition, do: "border-red-500", else: "border-blue-100"),
        ...
      ]}>Text</a>

  Внутри `{...}` **всегда** заключайте `if` в круглые скобки: `if(@other_condition, do: "...", else: "...")`.

  **Никогда** не делайте так — отсутствуют `[` и `]`:

      <a class={
        "px-2 text-white",
        @some_flag && "py-5"
      }> ...
      => Ошибка синтаксиса при компиляции из-за неверного атрибута HEEx

- Для генерации шаблона **никогда** не используйте `<% Enum.each %>` или не-for comprehensions; **всегда** используйте `<%= for item <- @collection do %>`.
- HTML-комментарии HEEx имеют вид `<%!-- comment --%>`. **Всегда** используйте этот синтаксис.
- HEEx интерполирует через `{...}` и `<%= ... %>`, но `<%= %>` работает **только внутри содержимого тегов**. В атрибутах и для значений используйте `{...}`. Блоки (`if`, `cond`, `case`, `for`) внутри тегов вставляйте через `<%= ... %>`.

  **Всегда** делайте так:

      <div id={@id}>
        {@my_assign}
        <%= if @some_block_condition do %>
          {@another_assign}
        <% end %>
      </div>

  **Никогда** не делайте так — будет синтаксическая ошибка:

      <%!-- ЭТО НЕВЕРНО, НИКОГДА ТАК НЕ ДЕЛАЙТЕ --%>
      <div id="<%= @invalid_interpolation %>">
        {if @invalid_block_construct do}
        {end}
      </div>
<!-- phoenix:html-end -->

<!-- phoenix:liveview-start -->
## Правила Phoenix LiveView

- **Никогда** не используйте устаревшие `live_redirect` и `live_patch`. В шаблонах **всегда** используйте `<.link navigate={href}>` и `<.link patch={href}>`, а в LiveView — `push_navigate` и `push_patch`.
- **Избегайте LiveComponent**, если нет конкретной веской необходимости.
- Имена LiveView должны иметь вид `AppWeb.WeatherLive` с суффиксом `Live`. Scope `:browser` **уже имеет alias** `AppWeb`, поэтому маршрут задаётся как `live "/weather", WeatherLive`.

### Потоки LiveView

- Для коллекций **всегда** используйте streams вместо обычных списков, чтобы не раздувать память:
  - добавление N элементов — `stream(socket, :messages, [new_msg])`;
  - сброс и новые элементы — `stream(socket, :messages, [new_msg], reset: true)`;
  - добавление в начало — `stream(socket, :messages, [new_msg], at: -1)`;
  - удаление — `stream_delete(socket, :messages, msg)`.

- При `stream/3` шаблон должен: 1) **всегда** иметь `phx-update="stream"` и DOM ID на родителе; 2) перебирать `@streams.stream_name`, используя id каждого дочернего элемента:

      <div id="messages" phx-update="stream">
        <div :for={{id, msg} <- @streams.messages} id={id}>
          {msg.text}
        </div>
      </div>

- Streams *не являются enumerable*: нельзя применять `Enum.filter/2` или `Enum.reject/2`. Для фильтрации или обновления **заново получите данные и полностью перезапишите stream с `reset: true`**:

      def handle_event("filter", %{"filter" => filter}, socket) do
        # Повторно получаем сообщения с учётом фильтра
        messages = list_messages(filter)

        {:noreply,
         socket
         |> assign(:messages_empty?, messages == [])
         # Сбрасываем stream и загружаем новые сообщения
         |> stream(:messages, messages, reset: true)}
      end

- Streams *не поддерживают подсчёт и пустые состояния*. Для количества используйте отдельный assign. Пустое состояние можно реализовать Tailwind-классами:

      <div id="tasks" phx-update="stream">
        <div class="hidden only:block">Задач пока нет</div>
        <div :for={{id, task} <- @streams.tasks} id={id}>
          {task.name}
        </div>
      </div>

  Это работает, только если пустое состояние — единственный HTML-блок рядом с for-comprehension потока.
- Если assign влияет на содержимое элементов stream, элементы **НЕОБХОДИМО повторно добавить в stream** вместе с обновлением assign:

      def handle_event("edit_message", %{"message_id" => message_id}, socket) do
        message = Chat.get_message!(message_id)
        edit_form = to_form(Chat.change_message(message, %{content: message.content}))

        # Повторно вставляем сообщение, чтобы @editing_message_id повлиял на элемент stream
        {:noreply,
         socket
         |> stream_insert(:messages, message)
         |> assign(:editing_message_id, String.to_integer(message_id))
         |> assign(:edit_form, edit_form)}
      end

  В шаблоне:

      <div id="messages" phx-update="stream">
        <div :for={{id, message} <- @streams.messages} id={id} class="flex group">
          {message.username}
          <%= if @editing_message_id == message.id do %>
            <%!-- Режим редактирования --%>
            <.form for={@edit_form} id="edit-form-#{message.id}" phx-submit="save_edit">
              ...
            </.form>
          <% end %>
        </div>
      </div>

- **Никогда** не используйте устаревшие `phx-update="append"` или `phx-update="prepend"`.

### Взаимодействие LiveView с JavaScript

- Если `phx-hook="MyHook"` сам управляет DOM, **необходимо** также установить `phx-update="ignore"`.
- Рядом с `phx-hook` **всегда** указывайте уникальный DOM ID, иначе возникнет ошибка компиляции.

Hooks бывают двух видов: 1) colocated JS-hooks для скриптов внутри HEEx; 2) внешние `phx-hook`, чьи JavaScript-объекты передаются конструктору `LiveSocket`.

#### Colocated JS-hooks

**Никогда** не вставляйте обычные теги `<script>` в HEEx: они несовместимы с LiveView. Для скриптов внутри шаблона **всегда используйте colocated JS-hook (`:type={Phoenix.LiveView.ColocatedHook}`)**:

    <input type="text" name="user[phone_number]" id="user-phone-number" phx-hook=".PhoneNumber" />
    <script :type={Phoenix.LiveView.ColocatedHook} name=".PhoneNumber">
      export default {
        mounted() {
          this.el.addEventListener("input", e => {
            let match = this.el.value.replace(/\D/g, "").match(/^(\d{3})(\d{3})(\d{4})$/)
            if(match) {
              this.el.value = `${match[1]}-${match[2]}-${match[3]}`
            }
          })
        }
      }
    </script>

- Colocated hooks автоматически включаются в `app.js`.
- Их имена **ВСЕГДА ДОЛЖНЫ** начинаться с `.`, например `.PhoneNumber`.

#### Внешний phx-hook

Внешние hooks (`<div id="myhook" phx-hook="MyHook">`) размещайте в `assets/js/` и передавайте LiveSocket:

    const MyHook = {
      mounted() { ... }
    }
    let liveSocket = new LiveSocket("/live", Socket, {
      hooks: { MyHook }
    });

#### События между клиентом и сервером

Для отправки событий клиенту используйте `push_event/3`. При его вызове **всегда** возвращайте или повторно связывайте socket:

    # Повторно связываем socket, чтобы сохранить событие
    socket = push_event(socket, "my_event", %{...})

    # Либо сразу возвращаем изменённый socket
    def handle_event("some_event", _, socket) do
      {:noreply, push_event(socket, "my_event", %{...})}
    end

На клиенте событие обрабатывается через `this.handleEvent`:

    mounted() {
      this.handleEvent("my_event", data => console.log("from server:", data));
    }

Клиент может отправить событие и получить ответ через `this.pushEvent`:

    mounted() {
      this.el.addEventListener("click", e => {
        this.pushEvent("my_event", { one: 1 }, reply => console.log("got reply from server:", reply));
      })
    }

Сервер обрабатывает его так:

    def handle_event("my_event", %{"one" => 1}, socket) do
      {:reply, %{two: 2}, socket}
    end

### Тесты LiveView

- Для проверок используйте `Phoenix.LiveViewTest` и подключённый `LazyHTML`.
- Формы тестируйте через `render_submit/2` и `render_change/2`.
- Составляйте пошаговый план, разделяя крупные сценарии на небольшие изолированные файлы. Начинайте с простых проверок существования содержимого, затем добавляйте интерактивные сценарии.
- В `element/2`, `has_element/2` и селекторах **всегда используйте ID ключевых элементов LiveView-шаблона**.
- **Никогда не тестируйте сырой HTML**; **всегда** используйте `element/2`, `has_element/2` и аналоги: `assert has_element?(view, "#my-form")`.
- Вместо изменчивого текста предпочитайте наличие ключевых элементов.
- Проверяйте результат поведения, а не детали реализации.
- `<.form>` и другие функции `Phoenix.Component` могут генерировать HTML не так, как вы предполагаете. Проверяйте фактическую структуру.
- При проблемах с селекторами временно выводите HTML, ограничивая его через `LazyHTML`:

      html = render(view)
      document = LazyHTML.from_fragment(html)
      matches = LazyHTML.filter(document, "your-complex-selector")
      IO.inspect(matches, label: "Matches")

### Работа с формами

#### Создание формы из params

Чтобы создать форму из params события `handle_event`:

    def handle_event("submitted", params, socket) do
      {:noreply, assign(socket, form: to_form(params))}
    end

Map, переданный в `to_form/1`, считается набором параметров формы со строковыми ключами.

Для вложенных параметров можно указать имя:

    def handle_event("submitted", %{"user" => user_params}, socket) do
      {:noreply, assign(socket, form: to_form(user_params, as: :user))}
    end

#### Создание формы из changeset

При changeset исходные данные, параметры и ошибки извлекаются из него; `:as` вычисляется автоматически. Например, есть схема:

    defmodule MyApp.Users.User do
      use Ecto.Schema
      ...
    end

Передайте changeset в `to_form`:

    %MyApp.Users.User{}
    |> Ecto.Changeset.change()
    |> to_form()

После отправки параметры будут в `%{"user" => user_params}`.

В шаблоне передайте form assign компоненту:

    <.form for={@form} id="todo-form" phx-change="validate" phx-submit="save">
      <.input field={@form[:field]} type="text" />
    </.form>

Всегда задавайте явный уникальный DOM ID, например `id="todo-form"`.

#### Предотвращение ошибок форм

В LiveView **всегда** используйте форму из `to_form/2`, а в шаблоне — `<.input>`. **Всегда обращайтесь к форме так**:

    <%!-- ВСЕГДА делайте так (верно) --%>
    <.form for={@form} id="my-form">
      <.input field={@form[:field]} type="text" />
    </.form>

И **никогда** не делайте так:

    <%!-- НИКОГДА не делайте так (неверно) --%>
    <.form for={@changeset} id="my-form">
      <.input field={@changeset[:field]} type="text" />
    </.form>

- **Запрещено** обращаться к changeset в шаблоне: это приводит к ошибкам.
- **Никогда** не используйте `<.form let={f} ...>`. **Всегда используйте `<.form for={@form} ...>`** и обращайтесь к полям через `@form[:field]`. UI **всегда** должен строиться на форме `to_form/2`, назначенной в LiveView и созданной из changeset.
<!-- phoenix:liveview-end -->

<!-- usage-rules-end -->
