# Назначение файла: UI-компоненты комнаты чата: сообщения, список чатлан, настройки и нижний ввод.
defmodule ChatWeb.RoomComponents do
  use ChatWeb, :html

  alias Chat.Appearance
  alias ChatWeb.Media

  attr(:appearance, :map, required: true)
  attr(:messages, :any, required: true)
  attr(:nickname, :string, required: true)
  attr(:peer_id, :string, required: true)

  def dialogue_frame(assigns) do
    ~H"""
    <main class="flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 md:border-b-0 md:border-r">
      <div class="flex items-end justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div>
          <h1 class="text-xl font-semibold">Общая комната</h1>
        </div>
        <p class="text-sm text-zinc-400">
          ты вошел как
          <span class="chat-current-nickname font-semibold" style={appearance_style(@appearance)}>
            {@nickname}
          </span>
        </p>
      </div>

      <div
        id="messages"
        phx-hook="ChatMessages"
        phx-update="stream"
        class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        <div
          :for={{dom_id, message} <- @messages}
          id={dom_id}
          data-message-kind={Map.get(message, :kind, :text)}
          data-private={to_string(Map.get(message, :kind) == :private)}
          data-addressed-to-me={
            if(Map.get(message, :recipient) == @nickname, do: "true", else: "false")
          }
          class={[
            "rounded border px-4 py-3 shadow-sm transition-colors",
            Map.get(message, :recipient) == @nickname &&
              "border-amber-300 bg-amber-300/20 ring-1 ring-inset ring-amber-200/30",
            Map.get(message, :kind) == :private && Map.get(message, :recipient) != @nickname &&
              "border-sky-400/50 bg-sky-400/10",
            Map.get(message, :kind) != :private && Map.get(message, :recipient) != @nickname &&
              "border-zinc-800 bg-zinc-900"
          ]}
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <button
              id={"message-author-#{dom_id}"}
              type="button"
              phx-hook="PrivateNickname"
              data-private-nickname={message.author}
              class="chat-message-author font-semibold transition hover:underline"
              style={appearance_style(message)}
            >
              {message.author}
            </button>
            <span class="text-xs text-zinc-500">{message.at}</span>
          </div>
          <p
            :if={Map.get(message, :kind) == :private}
            class="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-300"
          >
            <%= if message.recipient == @nickname do %>
              Лично вам
            <% else %>
              Лично для {message.recipient}
            <% end %>
          </p>
          <%= case Map.get(message, :kind, :text) do %>
            <% kind when kind in [:image, :audio] -> %>
              <div
                id={"media-preview-#{message.share_id}"}
                phx-update="ignore"
                data-media-placeholder
                data-media-kind={kind}
                data-share-id={message.share_id}
                data-sender-peer={message.sender_peer}
                data-owned={to_string(message.sender_peer == @peer_id)}
                data-file-name={message.name}
                data-content-type={message.content_type}
                data-file-size={message.size}
                class="mt-3 overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-950/80"
              >
                <div class="flex min-h-28 flex-col items-center justify-center gap-3 p-5 text-center">
                  <div class="flex size-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                    <.icon
                      name={if(kind == :image, do: "hero-photo", else: "hero-musical-note")}
                      class="size-6"
                    />
                  </div>
                  <div>
                    <p class="max-w-md break-all text-sm font-medium text-zinc-200">
                      {message.name}
                    </p>
                    <p class="mt-1 text-xs text-zinc-500">
                      {if(kind == :image,
                        do: "Изображение скрыто",
                        else: "Музыка с устройства автора"
                      )} · {format_file_size(message.size)}
                    </p>
                  </div>
                  <button
                    id={"open-media-#{message.share_id}"}
                    type="button"
                    data-open-media
                    class="rounded-lg border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:bg-amber-300/10"
                  >
                    {if(kind == :image, do: "Показать изображение", else: "Слушать")}
                  </button>
                </div>
              </div>
            <% _text -> %>
              <p
                class="chat-message-body mt-1 break-words text-sm leading-6"
                style={appearance_style(message)}
              >
                {message.body}
              </p>
          <% end %>
        </div>
      </div>
    </main>
    """
  end

  attr(:joined, :boolean, required: true)
  attr(:settings_open, :boolean, required: true)
  attr(:online, :list, required: true)
  attr(:settings_form, :any, required: true)
  attr(:themes, :list, required: true)
  attr(:theme_id, :string, required: true)
  attr(:theme_modes, :list, required: true)
  attr(:appearance, :map, required: true)
  attr(:nickname, :string, required: true)

  def chatlan_sidebar(assigns) do
    ~H"""
    <aside class="hidden min-h-0 overflow-y-auto bg-zinc-900/80 p-4 md:block">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Сейчас в чате</h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="rounded bg-emerald-500/15 px-2 py-1 text-sm text-emerald-300">
            {length(@online)}
          </span>
          <%= if @joined do %>
            <button
              id="toggle-settings"
              type="button"
              phx-click="toggle_settings"
              class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-amber-300 hover:text-amber-300"
            >
              {if @settings_open, do: "Закрыть", else: "Настройки"}
            </button>
          <% end %>
        </div>
      </div>

      <%= if @joined && @settings_open do %>
        <.settings_panel
          settings_form={@settings_form}
          themes={@themes}
          theme_id={@theme_id}
          theme_modes={@theme_modes}
          appearance={@appearance}
          nickname={@nickname}
        />
      <% end %>

      <div id="online-list" class="mt-4 space-y-2">
        <%= for user <- @online do %>
          <div class="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <button
              id={"profile-link-#{user.nickname}"}
              type="button"
              phx-click="open_profile"
              phx-value-nickname={user.nickname}
              aria-label={"Открыть анкету #{user.nickname}"}
              class="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-amber-300/15 hover:text-amber-300"
            >
              <.icon name="hero-user-circle" class="size-5" />
            </button>
            <button
              id={"private-message-#{user.nickname}"}
              type="button"
              phx-hook="PrivateNickname"
              data-private-nickname={user.nickname}
              class="chat-user-nickname min-w-0 flex-1 truncate text-left text-sm font-medium transition hover:underline"
              style={appearance_style(user)}
            >
              {user.nickname}
            </button>
            <span class="text-xs text-zinc-500">{user.online_at}</span>
          </div>
        <% end %>
      </div>
    </aside>
    """
  end

  attr(:message_form, :any, required: true)
  attr(:message_error, :string, default: nil)
  attr(:media_error, :string, default: nil)
  attr(:registered, :boolean, required: true)
  attr(:peer_id, :string, required: true)
  attr(:ice_servers, :list, required: true)

  def message_input(assigns) do
    assigns =
      assign(assigns, :emojis, [
        "😀",
        "😂",
        "😊",
        "😍",
        "🥰",
        "😎",
        "🤔",
        "😢",
        "😡",
        "👍",
        "👎",
        "👏",
        "🙏",
        "🔥",
        "❤️",
        "🎉",
        "✨",
        "💯",
        "👋",
        "🤝",
        "💬",
        "🚀",
        "☕",
        "🌙"
      ])

    ~H"""
    <.form
      for={@message_form}
      id="message-form"
      phx-submit="send_message"
      phx-hook="PrivateMessageComposer"
      class="relative shrink-0 border-t border-zinc-800 bg-zinc-900 p-3 transition"
    >
      <p
        :if={@message_error}
        id="message-error"
        class="mb-2 text-sm text-red-300"
        role="alert"
      >
        {@message_error}
      </p>
      <p
        :if={@media_error}
        id="media-error"
        class="mb-2 text-sm text-red-300"
        role="alert"
      >
        {@media_error}
      </p>
      <div id="emoji-input-controls" phx-hook=".EmojiPicker" class="flex gap-3">
        <div class="relative hidden shrink-0 sm:block">
          <button
            id="toggle-emoji-picker"
            type="button"
            phx-click={JS.toggle_class("emoji-picker-closed", to: "#emoji-picker")}
            aria-label="Выбрать эмодзи"
            aria-controls="emoji-picker"
            class="flex h-full min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 text-zinc-400 transition hover:border-amber-300 hover:text-amber-300"
          >
            <.icon name="hero-face-smile" class="size-5" />
          </button>
          <div
            id="emoji-picker"
            class="emoji-picker-closed absolute bottom-full left-0 z-40 mb-2 grid w-64 grid-cols-6 gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl"
          >
            <button
              :for={emoji <- @emojis}
              type="button"
              data-emoji={emoji}
              aria-label={"Вставить #{emoji}"}
              class="flex size-9 items-center justify-center rounded-lg text-xl transition hover:bg-amber-300/15 hover:scale-110"
            >
              {emoji}
            </button>
          </div>
        </div>
        <input
          id="message-body"
          name={@message_form[:body].name}
          value={@message_form[:body].value}
          autocomplete="off"
          maxlength={Chat.Messages.max_body_length()}
          placeholder="Напиши сообщение..."
          class="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
        />
        <div
          id="media-share-controls"
          phx-hook="MediaSharing"
          phx-update="ignore"
          data-can-share={to_string(@registered)}
          data-peer-id={@peer_id}
          data-max-image-size={Chat.MediaShares.max_image_size()}
          data-max-audio-size={Chat.MediaShares.max_audio_size()}
          data-relay-chunk-size={Chat.MediaShares.relay_chunk_size()}
          data-accepted-types={Jason.encode!(Chat.MediaShares.accepted_types())}
          data-ice-servers={Jason.encode!(@ice_servers)}
          class="shrink-0"
        >
          <input
            :if={@registered}
            id="media-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp3,audio/x-mp3,audio/ogg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,.mp3,.ogg,.wav,.m4a,.aac"
            class="sr-only"
            tabindex="-1"
          />
          <button
            id="attach-media"
            type="button"
            disabled={not @registered}
            aria-label={
              if(@registered,
                do: "Прикрепить изображение или музыку",
                else: "Вложения доступны после регистрации"
              )
            }
            title={
              if(@registered,
                do: "Прикрепить изображение или аудиофайл",
                else: "Только для зарегистрированных чатлан"
              )
            }
            class="flex h-full min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 text-zinc-400 transition hover:border-amber-300 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-400"
          >
            <.icon name="hero-paper-clip" class="size-5" />
          </button>
          <p id="media-client-error" class="hidden" role="alert"></p>
          <div
            id="media-drop-overlay"
            class="pointer-events-none absolute inset-1 z-30 hidden items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-zinc-950/95 text-sm font-semibold text-amber-200"
          >
            Отпусти изображение или музыку здесь
          </div>
        </div>
        <button
          id="send-message"
          type="submit"
          aria-label="Отправить сообщение"
          class="flex shrink-0 items-center justify-center rounded bg-amber-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 sm:px-4"
        >
          <.icon name="hero-paper-airplane" class="size-5 sm:hidden" />
          <span class="hidden sm:inline">Отправить</span>
        </button>
        <button
          id="leave-chat"
          type="button"
          phx-click="leave_chat"
          aria-label="Выйти из чата"
          class="flex shrink-0 items-center justify-center rounded border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-red-300 hover:text-red-200 sm:px-4"
        >
          <.icon name="hero-arrow-right-start-on-rectangle" class="size-5 sm:hidden" />
          <span class="hidden sm:inline">Выход</span>
        </button>
      </div>

      <script :type={Phoenix.LiveView.ColocatedHook} name=".EmojiPicker">
        export default {
          mounted() {
            this.el.addEventListener("click", event => {
              const emojiButton = event.target.closest("[data-emoji]")
              if (!emojiButton) return

              const input = this.el.querySelector("#message-body")
              const start = input.selectionStart ?? input.value.length
              const end = input.selectionEnd ?? input.value.length
              input.setRangeText(emojiButton.dataset.emoji, start, end, "end")
              input.dispatchEvent(new Event("input", {bubbles: true}))
              this.el.querySelector("#emoji-picker").classList.add("emoji-picker-closed")
              input.focus()
            })
          }
        }
      </script>
    </.form>
    """
  end

  attr(:profile, :any, required: true)
  attr(:form, :any, required: true)
  attr(:editable, :boolean, required: true)
  attr(:uploads, :map, required: true)

  def profile_modal(assigns) do
    assigns =
      assign(
        assigns,
        :photo_url,
        Media.data_url(assigns.profile.photo, assigns.profile.photo_content_type)
      )

    ~H"""
    <div
      id="profile-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        phx-click="close_profile"
        class="absolute inset-0"
        aria-label="Закрыть анкету"
      ></button>
      <section class="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-7">
        <div class="mb-8 flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Анкета</p>
            <h2 class="mt-1 text-2xl font-semibold text-white">{@profile.user.nickname}</h2>
          </div>
          <button
            id="close-profile"
            type="button"
            phx-click="close_profile"
            class="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
          >
            <.icon name="hero-x-mark" class="size-5" />
          </button>
        </div>

        <.form
          for={@form}
          id="profile-form"
          phx-change="validate_profile"
          phx-submit="save_profile"
          class="grid gap-8 sm:grid-cols-[12rem_minmax(0,1fr)]"
        >
          <div class="space-y-3">
            <div class="aspect-square overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
              <%= cond do %>
                <% @uploads.profile_photo.entries != [] -> %>
                  <.live_img_preview
                    entry={List.first(@uploads.profile_photo.entries)}
                    class="h-full w-full object-cover"
                  />
                <% @photo_url -> %>
                  <img
                    src={@photo_url}
                    alt={"Фото #{@profile.user.nickname}"}
                    class="h-full w-full object-cover"
                  />
                <% true -> %>
                  <div class="flex h-full items-center justify-center text-zinc-600">
                    <.icon name="hero-user" class="size-16" />
                  </div>
              <% end %>
            </div>
            <%= if @editable do %>
              <div id="profile-photo-compressor" phx-hook=".ProfilePhotoCompressor">
                <.live_file_input
                  upload={@uploads.profile_photo}
                  class="block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
                />
                <p class="mt-2 text-xs leading-4 text-zinc-500">
                  JPG, PNG или WebP. Фото будет уменьшено до 1280×1280.
                </p>
                <%= if upload_errors(@uploads.profile_photo) != [] do %>
                  <p id="profile-photo-error" class="mt-2 text-xs text-red-300">
                    Фото должно быть подходящего формата и не больше 1,5 МБ.
                  </p>
                <% end %>
              </div>
            <% end %>
          </div>

          <div class="space-y-5">
            <.input
              name="profile[nickname]"
              value={@profile.user.nickname}
              label="Ник"
              readonly
              disabled
            />
            <.input field={@form[:name]} label="Имя" readonly={!@editable} maxlength="80" />
            <.input
              field={@form[:birth_date]}
              type="date"
              label="Дата рождения"
              readonly={!@editable}
            />
            <.input
              field={@form[:gender]}
              type="select"
              label="Пол"
              prompt="Не указан"
              options={[{"Мужской", "male"}, {"Женский", "female"}, {"Другой", "other"}]}
              disabled={!@editable}
            />
            <.input
              field={@form[:about]}
              type="textarea"
              label="О себе"
              readonly={!@editable}
              maxlength="1000"
            />
            <%= if @editable do %>
              <button
                id="save-profile"
                type="submit"
                class="mt-2 w-full rounded-xl bg-amber-300 px-4 py-3.5 font-semibold text-zinc-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-50"
              >Сохранить анкету</button>
            <% end %>
          </div>
        </.form>

        <script :type={Phoenix.LiveView.ColocatedHook} name=".ProfilePhotoCompressor">
          export default {
            mounted() {
              this.el.addEventListener("change", async event => {
                const input = event.target
                if (input.dataset.compressed || !input.files?.[0]) return
                event.preventDefault()
                event.stopImmediatePropagation()

                const image = await createImageBitmap(input.files[0])
                const scale = Math.min(1, 1280 / image.width, 1280 / image.height)
                const canvas = document.createElement("canvas")
                canvas.width = Math.max(1, Math.round(image.width * scale))
                canvas.height = Math.max(1, Math.round(image.height * scale))
                canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height)
                image.close()

                const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82))
                const files = new DataTransfer()
                files.items.add(new File([blob], "profile.webp", {type: "image/webp"}))
                input.files = files.files
                input.dataset.compressed = "true"
                input.dispatchEvent(new Event("change", {bubbles: true}))
              }, true)
            }
          }
        </script>
      </section>
    </div>
    """
  end

  attr(:settings_form, :any, required: true)
  attr(:themes, :list, required: true)
  attr(:theme_id, :string, required: true)
  attr(:theme_modes, :list, required: true)
  attr(:appearance, :map, required: true)
  attr(:nickname, :string, required: true)

  defp settings_panel(assigns) do
    ~H"""
    <.form
      for={@settings_form}
      id="preferences-form"
      phx-change="preview_preferences"
      phx-submit="save_preferences"
      class="mt-4 rounded border border-zinc-800 bg-zinc-950/70 p-3"
    >
      <div class="space-y-3">
        <label class="block text-sm">
          <span class="mb-1 block text-zinc-400">Тема</span>
          <select
            id="theme-id"
            name={@settings_form[:theme_id].name}
            class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
          >
            <%= for theme <- @themes do %>
              <option value={theme.id} selected={theme.id == @theme_id}>
                {theme.name} · {if theme.mode == "light", do: "Светлая", else: "Тёмная"}
              </option>
            <% end %>
          </select>
        </label>

        <%= for mode <- @theme_modes do %>
          <div class="rounded border border-zinc-800 bg-zinc-900 p-2">
            <p class="mb-2 text-xs font-semibold text-zinc-400">
              Цвета для режима «{mode.name}»
            </p>

            <div class="grid grid-cols-2 gap-2">
              <label class="block text-sm">
                <span class="mb-1 block text-zinc-400">Ник</span>
                <input
                  id={"#{mode.id}-nickname-color"}
                  type="color"
                  name={"preferences[appearance][#{mode.id}][nickname_color]"}
                  value={mode_colors(@appearance, mode.id)["nickname_color"]}
                  class="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950"
                />
              </label>

              <label class="block text-sm">
                <span class="mb-1 block text-zinc-400">Текст</span>
                <input
                  id={"#{mode.id}-text-color"}
                  type="color"
                  name={"preferences[appearance][#{mode.id}][text_color]"}
                  value={mode_colors(@appearance, mode.id)["text_color"]}
                  class="h-9 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-950"
                />
              </label>
            </div>
          </div>
        <% end %>

        <div class="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm">
          <span class="chat-preview-nickname font-semibold" style={appearance_style(@appearance)}>
            {@nickname}
          </span>
          <span class="chat-preview-text" style={appearance_style(@appearance)}>
            пример текста
          </span>
        </div>

        <button
          id="save-preferences"
          type="submit"
          class="w-full rounded bg-amber-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
        >
          Сохранить
        </button>
      </div>
    </.form>
    """
  end

  defp mode_colors(appearance, mode_id) do
    Appearance.for_mode(appearance, mode_id)
  end

  defp appearance_style(%{appearance: appearance}) do
    appearance_style(appearance)
  end

  defp appearance_style(appearance) do
    dark = Appearance.for_mode(appearance, "dark")
    light = Appearance.for_mode(appearance, "light")

    [
      "--nick-dark: #{dark["nickname_color"]}",
      "--text-dark: #{dark["text_color"]}",
      "--nick-light: #{light["nickname_color"]}",
      "--text-light: #{light["text_color"]}"
    ]
    |> Enum.join("; ")
  end

  defp format_file_size(size) when is_integer(size) and size >= 1_000_000 do
    "#{Float.round(size / 1_000_000, 1)} МБ"
  end

  defp format_file_size(size) when is_integer(size) and size >= 1_000 do
    "#{Float.round(size / 1_000, 1)} КБ"
  end

  defp format_file_size(size) when is_integer(size), do: "#{size} Б"
end
