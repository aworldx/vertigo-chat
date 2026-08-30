# Назначение файла: UI-компоненты комнаты чата: сообщения, список чатлан, настройки и нижний ввод.
defmodule ChatWeb.RoomComponents do
  use ChatWeb, :html

  alias Chat.Appearance
  alias Chat.Ranks
  alias ChatWeb.Media

  attr(:messages, :any, required: true)
  attr(:nickname, :string, required: true)
  attr(:peer_id, :string, required: true)
  attr(:appearance, :map, required: true)
  attr(:online, :list, required: true)
  attr(:typing, :list, default: [])

  def dialogue_frame(assigns) do
    ~H"""
    <main class="flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 md:border-b-0 md:border-r">
      <div
        id="messages"
        phx-hook="ChatMessages"
        phx-update="stream"
        class="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <div
          :for={{dom_id, message} <- @messages}
          id={dom_id}
          data-message-kind={Map.get(message, :kind, :text)}
          data-private={to_string(Map.get(message, :kind) == :private)}
          data-addressed-to-me={
            if(Map.get(message, :recipient) == @nickname, do: "true", else: "false")
          }
          data-message-frame={to_string(framed_message?(message, @appearance))}
          data-reaction-counts={
            if(message.author == @nickname && reactable_message?(message),
              do: Jason.encode!(reaction_counts(message))
            )
          }
          phx-hook={
            if(message.author == @nickname && reactable_message?(message),
              do: ".ReactionBurst"
            )
          }
          class={[
            "chat-message-entry group/message relative transition-colors",
            Map.get(message, :kind) == :system && "px-3 py-0.5 text-center",
            Map.get(message, :kind) == :command && "px-1 py-1",
            Map.get(message, :kind) not in [:system, :command] &&
              framed_message?(message, @appearance) &&
              "rounded border px-3 pb-2 pt-5 shadow-sm",
            Map.get(message, :kind) not in [:system, :command] &&
              not framed_message?(message, @appearance) && "px-1",
            Map.get(message, :kind) != :system && not framed_message?(message, @appearance) &&
              Map.get(message, :recipient) == @nickname && "rounded bg-amber-300/20",
            Map.get(message, :kind) != :system && framed_message?(message, @appearance) &&
              Map.get(message, :recipient) == @nickname &&
              "border-amber-300 bg-amber-300/20 ring-1 ring-inset ring-amber-200/30",
            Map.get(message, :kind) == :private && framed_message?(message, @appearance) &&
              Map.get(message, :recipient) != @nickname &&
              "border-sky-400/50 bg-sky-400/10",
            Map.get(message, :kind) not in [:private, :system] &&
              framed_message?(message, @appearance) &&
              Map.get(message, :recipient) != @nickname &&
              "border-zinc-800 bg-zinc-900"
          ]}
        >
          <button
            :if={
              Map.get(message, :kind) not in [:system, :command] &&
                framed_message?(message, @appearance)
            }
            id={"message-author-#{dom_id}"}
            type="button"
            phx-hook="PrivateNickname"
            data-private-nickname={message.author}
            class="chat-message-author absolute -top-2 left-2 z-10 max-w-[65%] truncate rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold leading-4 shadow-sm transition hover:border-zinc-500 hover:underline"
            style={appearance_style(message)}
          >
            {message.author}
          </button>
          <time
            :if={
              Map.get(message, :kind) not in [:system, :command] &&
                framed_message?(message, @appearance)
            }
            id={"message-time-#{dom_id}"}
            datetime={Map.get(message, :sent_at)}
            phx-hook=".LocalMessageTime"
            phx-update="ignore"
            class="absolute right-2 top-1 text-[10px] text-zinc-500"
          >
            {message.at}
          </time>
          <p
            :if={Map.get(message, :kind) == :private}
            class="mb-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
          >
            <%= if message.recipient == @nickname do %>
              Лично вам
            <% else %>
              Лично для {message.recipient}
            <% end %>
          </p>
          <%= case Map.get(message, :kind, :text) do %>
            <% :system -> %>
              <p class="inline-flex items-center gap-2 text-xs leading-4 text-zinc-500">
                <span>{message.body}</span>
                <time
                  id={"message-time-#{dom_id}"}
                  datetime={Map.get(message, :sent_at)}
                  phx-hook=".LocalMessageTime"
                  phx-update="ignore"
                  class="text-[10px] text-zinc-600"
                >
                  {message.at}
                </time>
              </p>
            <% :command -> %>
              <section
                class="rounded-xl border border-amber-300/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/20"
                data-command-result={message.command}
              >
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                  <.icon name="hero-command-line" class="size-4" />
                  <span>{message.title}</span>
                  <time
                    id={"message-time-#{dom_id}"}
                    datetime={message.sent_at}
                    phx-hook=".LocalMessageTime"
                    phx-update="ignore"
                    class="ml-auto text-[10px] font-normal normal-case tracking-normal text-zinc-500"
                  >
                    {message.at}
                  </time>
                </div>
                <p class="mt-2 text-sm leading-5 text-zinc-300">{message.body}</p>
                <div :if={message.entries != []} class="mt-3 flex flex-wrap gap-2">
                  <%= for entry <- message.entries do %>
                    <button
                      :if={Map.has_key?(entry, :nickname) && message.command == :who}
                      id={"command-chatlan-#{dom_id}-#{entry.nickname}"}
                      type="button"
                      phx-click="start_public_message"
                      phx-value-nickname={entry.nickname}
                      class="rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-2.5 py-1 text-sm font-medium text-emerald-200 transition hover:border-emerald-200 hover:bg-emerald-300/20"
                    >
                      {entry.nickname}
                    </button>
                    <span
                      :if={Map.has_key?(entry, :nickname) && message.command != :who}
                      class="rounded-lg border border-zinc-700 bg-zinc-950/50 px-2.5 py-1 text-sm text-zinc-300"
                    >
                      {entry.nickname}
                    </span>
                    <p
                      :if={Map.has_key?(entry, :label)}
                      class="w-full text-sm leading-5 text-zinc-300 sm:w-[calc(50%-0.25rem)]"
                    >
                      <code class="font-semibold text-amber-200">{entry.label}</code>
                      <span class="text-zinc-500"> — {entry.description}</span>
                    </p>
                  <% end %>
                </div>
              </section>
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
              <%= if framed_message?(message, @appearance) do %>
                <p
                  class="chat-message-body break-words pr-12 text-sm leading-5"
                  style={appearance_style(message)}
                >
                  <%= case nickname_parts(message, @online) do %>
                    <% {before, prefix, whitespace, body, nickname} -> %>
                      {before}<strong
                        class="chat-message-recipient font-semibold"
                        style={nickname_appearance_style(nickname, @online)}
                      >{prefix}</strong>{whitespace}{body}
                    <% nil -> %>
                      {message.body}
                  <% end %>
                </p>
              <% else %>
                <p class="break-words text-sm leading-5" data-compact-message>
                  <button
                    id={"message-author-#{dom_id}"}
                    type="button"
                    phx-hook="PrivateNickname"
                    data-private-nickname={message.author}
                    class="chat-message-author font-semibold hover:underline"
                    style={appearance_style(message)}
                  >{message.author}:</button>
                  <span class="chat-message-body" style={appearance_style(message)}>
                    <%= case nickname_parts(message, @online) do %>
                      <% {before, prefix, whitespace, body, nickname} -> %>
                        {before}<strong
                          class="chat-message-recipient font-semibold"
                          style={nickname_appearance_style(nickname, @online)}
                        >{prefix}</strong>{whitespace}{body}
                      <% nil -> %>
                        {message.body}
                    <% end %>
                  </span>
                </p>
              <% end %>
          <% end %>
          <div
            :if={reactable_message?(message) && framed_message?(message, @appearance)}
            class="absolute -bottom-2.5 right-2 z-20 flex max-w-[90%] flex-wrap items-center justify-end gap-1"
            aria-label="Реакции на сообщение"
          >
            <%= for emoji <- present_reactions(message) do %>
              <button
                :if={message.author != @nickname}
                id={"reaction-#{dom_id}-#{reaction_dom_id(emoji)}"}
                type="button"
                phx-click="toggle_reaction"
                phx-value-message-id={message.id}
                phx-value-emoji={emoji}
                data-reaction-emoji={emoji}
                data-reaction-count={reaction_count(message, emoji)}
                aria-pressed={to_string(reacted?(message, emoji, @peer_id))}
                class={[
                  "chat-reaction-entry inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] shadow-sm transition",
                  reacted?(message, emoji, @peer_id) &&
                    "border-amber-300/70 bg-amber-950 text-amber-100",
                  not reacted?(message, emoji, @peer_id) &&
                    "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                ]}
              >
                <span>{emoji}</span>
                <span class="tabular-nums">{reaction_count(message, emoji)}</span>
              </button>
              <span
                :if={message.author == @nickname}
                id={"reaction-#{dom_id}-#{reaction_dom_id(emoji)}"}
                data-reaction-emoji={emoji}
                data-reaction-count={reaction_count(message, emoji)}
                class="chat-reaction-entry inline-flex h-5 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-1.5 text-[11px] text-zinc-300 shadow-sm"
              >
                <span>{emoji}</span>
                <span class="tabular-nums">{reaction_count(message, emoji)}</span>
              </span>
            <% end %>

            <details :if={message.author != @nickname} class="relative">
              <summary
                class="flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-400 shadow-sm transition hover:border-amber-300/60 hover:text-amber-200 [&::-webkit-details-marker]:hidden"
                aria-label="Добавить реакцию"
                title="Добавить реакцию"
              >
                <.icon name="hero-face-smile" class="size-3" />
              </summary>
              <div class="absolute bottom-full right-0 z-30 mb-1.5 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl">
                <button
                  :for={emoji <- Chat.Messages.reaction_emojis()}
                  type="button"
                  phx-click="toggle_reaction"
                  phx-value-message-id={message.id}
                  phx-value-emoji={emoji}
                  data-reaction-picker-emoji={emoji}
                  aria-label={"Поставить реакцию #{emoji}"}
                  class="flex size-8 items-center justify-center rounded-lg text-lg transition hover:bg-amber-300/15 hover:scale-110"
                >
                  {emoji}
                </button>
              </div>
            </details>
          </div>
          <div
            :if={message.author == @nickname && reactable_message?(message)}
            id={"reaction-burst-#{dom_id}"}
            data-reaction-burst-layer
            phx-update="ignore"
            class="pointer-events-none absolute inset-0 z-30 overflow-visible"
            aria-hidden="true"
          >
          </div>
        </div>
      </div>
      <p
        id="typing-indicator"
        class="h-6 shrink-0 px-4 text-xs italic leading-6 text-zinc-500"
        aria-live="polite"
      >
        {typing_label(@typing)}
      </p>
      <script :type={Phoenix.LiveView.ColocatedHook} name=".LocalMessageTime">
        export default {
          mounted() {
            if (!this.el.dateTime) return

            const sentAt = new Date(this.el.dateTime)
            if (Number.isNaN(sentAt.getTime())) return

            this.el.textContent = new Intl.DateTimeFormat([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            }).format(sentAt)
          }
        }
      </script>
      <script :type={Phoenix.LiveView.ColocatedHook} name=".ReactionBurst">
        export default {
          mounted() {
            this.reactionCounts = this.readReactionCounts()
          },

          updated() {
            const nextCounts = this.readReactionCounts()

            for (const [emoji, count] of Object.entries(nextCounts)) {
              const added = Math.min(3, Math.max(0, count - (this.reactionCounts[emoji] || 0)))
              for (let index = 0; index < added; index++) this.releaseEmoji(emoji, index)
            }

            this.reactionCounts = nextCounts
          },

          readReactionCounts() {
            try {
              return JSON.parse(this.el.dataset.reactionCounts || "{}")
            } catch (_error) {
              return {}
            }
          },

          releaseEmoji(emoji, index) {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

            const layer = this.el.querySelector("[data-reaction-burst-layer]")
            if (!layer) return

            const particle = document.createElement("span")
            particle.className = "chat-reaction-burst"
            particle.textContent = emoji
            particle.style.setProperty("--reaction-drift", `${(index - 1) * 1.1 + (Math.random() - 0.5) * 1.4}rem`)
            particle.addEventListener("animationend", () => particle.remove(), {once: true})
            layer.appendChild(particle)
          }
        }
      </script>
    </main>
    """
  end

  defp typing_label([]), do: ""
  defp typing_label([nickname]), do: "#{nickname} печатает…"
  defp typing_label([first, second]), do: "#{first} и #{second} печатают…"
  defp typing_label(nicknames), do: "#{length(nicknames)} участника печатают…"

  defp reactable_message?(message) do
    Map.get(message, :kind, :text) == :text && message.author != "system"
  end

  defp framed_message?(%{kind: :text, author: author}, appearance)
       when author != "system",
       do: Appearance.message_frame?(appearance)

  defp framed_message?(_message, _appearance), do: true

  defp nickname_parts(%{kind: :private, recipient: recipient, body: body}, _online)
       when is_binary(recipient) and is_binary(body),
       do: {"", "^#{recipient},", " ", body, recipient}

  defp nickname_parts(%{recipient: recipient, body: body}, online) when is_binary(body) do
    nickname = recipient || nickname_in_body(body, online)

    if is_binary(nickname) do
      nickname_parts_from_body(body, nickname)
    end
  end

  defp nickname_parts(_message, _online), do: nil

  defp nickname_parts_from_body(body, nickname) do
    regex = Regex.compile!("(?<![\\p{L}\\p{N}_-])(#{Regex.escape(nickname)},?)(\\s*)", "u")

    case Regex.run(regex, body, return: :index) do
      [{index, _length}, {_prefix_index, prefix_length}, {space_index, space_length}] ->
        before = binary_part(body, 0, index)
        prefix = binary_part(body, index, prefix_length)
        whitespace = binary_part(body, space_index, space_length)
        rest_index = space_index + space_length
        rest = binary_part(body, rest_index, byte_size(body) - rest_index)
        {before, prefix, whitespace, rest, nickname}

      _no_address ->
        nil
    end
  end

  defp nickname_in_body(body, online) do
    online
    |> Enum.map(& &1.nickname)
    |> Enum.filter(&is_binary/1)
    |> Enum.sort_by(&byte_size/1, :desc)
    |> Enum.find(fn nickname ->
      Regex.match?(
        Regex.compile!("(?<![\\p{L}\\p{N}_-])#{Regex.escape(nickname)}(?![\\p{L}\\p{N}_-])", "u"),
        body
      )
    end)
  end

  defp present_reactions(message) do
    Enum.filter(Chat.Messages.reaction_emojis(), &(reaction_count(message, &1) > 0))
  end

  defp reaction_count(message, emoji) do
    message
    |> Map.get(:reactions, %{})
    |> Map.get(emoji, MapSet.new())
    |> MapSet.size()
  end

  defp reaction_counts(message) do
    Map.new(Chat.Messages.reaction_emojis(), &{&1, reaction_count(message, &1)})
  end

  defp reacted?(message, emoji, peer_id) do
    message
    |> Map.get(:reactions, %{})
    |> Map.get(emoji, MapSet.new())
    |> MapSet.member?(peer_id)
  end

  defp reaction_dom_id(emoji), do: Base.url_encode64(emoji, padding: false)

  attr(:joined, :boolean, required: true)
  attr(:online, :list, required: true)
  attr(:peer_id, :string, required: true)

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
              Настройки
            </button>
          <% end %>
        </div>
      </div>

      <div id="online-list" class="mt-4 space-y-2">
        <%= for user <- @online do %>
          <div class="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <button
              :if={user.registered?}
              id={"profile-link-#{user.id}"}
              type="button"
              phx-click="open_profile"
              phx-value-nickname={user.nickname}
              aria-label={"Открыть анкету #{user.nickname}"}
              class="shrink-0 rounded-md p-1 text-zinc-500 transition hover:bg-amber-300/15 hover:text-amber-300"
            >
              <.icon name="hero-user-circle" class="size-5" />
            </button>
            <span
              :if={Map.get(user, :bot?, false)}
              id={"bot-chatlan-#{user.id}"}
              class="flex size-7 shrink-0 items-center justify-center text-amber-300"
              title="Чат-бот"
              aria-label="Чат-бот"
            >
              <.icon name="hero-video-camera" class="size-5" />
            </span>
            <span
              :if={not user.registered? && not Map.get(user, :bot?, false)}
              id={"anonymous-chatlan-#{user.id}"}
              class="flex size-7 shrink-0 items-center justify-center"
              title="Анонимный чатланин"
              aria-label="Анонимный чатланин"
            >
              <span
                class="flex size-5 items-center justify-center rounded-full border border-dashed border-zinc-500 text-xs font-semibold text-zinc-400"
                aria-hidden="true"
              >?</span>
            </span>
            <button
              id={"private-message-#{user.id}"}
              type="button"
              phx-hook="PrivateNickname"
              data-private-nickname={user.nickname}
              class="chat-user-nickname min-w-0 flex-1 truncate text-left text-sm font-medium transition hover:underline"
              style={appearance_style(user)}
            >
              {user.nickname}
            </button>
            <.rank_badge rank={Map.get(user, :rank)} />
            <span
              class="shrink-0 text-[10px] font-medium"
              role={if(user.peer_id == @peer_id, do: "status")}
              aria-live={if(user.peer_id == @peer_id, do: "polite")}
            >
              <span
                :if={not Map.get(user, :busy?, false)}
                id={if(user.peer_id == @peer_id, do: "current-chatlan-online")}
                class="inline-flex items-center gap-1 text-emerald-300"
              >
                <span class="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_currentColor]"></span>
                В сети
              </span>
              <span
                :if={Map.get(user, :bot?, false) && Map.get(user, :busy?, false)}
                id="bot-chatlan-busy"
                class="inline-flex items-center gap-1 text-amber-300"
                aria-label="Хичкок занят"
              >
                <span class="size-1.5 rounded-full bg-amber-300"></span> Занят
              </span>
              <span
                id={if(user.peer_id == @peer_id, do: "current-chatlan-reconnecting")}
                class="inline-flex items-center gap-1 text-amber-300"
                hidden
              >
                <.icon name="hero-arrow-path" class="size-3 motion-safe:animate-spin" /> Связь…
              </span>
            </span>
          </div>
        <% end %>
      </div>
    </aside>
    """
  end

  attr(:rank, :map, default: nil)

  def rank_badge(assigns) do
    ~H"""
    <span
      :if={@rank}
      class="ml-1 inline-flex shrink-0 items-center gap-1 align-middle text-[10px] font-medium text-amber-200"
      title={@rank.title}
      aria-label={@rank.title}
    >
      <.rank_icon rank={@rank} class="size-4" />
      <span class="sr-only">{@rank.title}</span>
    </span>
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
      <fieldset
        id="emoji-input-controls"
        phx-hook=".EmojiPicker"
        class="flex min-w-0 flex-wrap gap-3 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-nowrap"
      >
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
            phx-click-away={JS.add_class("emoji-picker-closed", to: "#emoji-picker")}
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
        <div
          id="command-autocomplete"
          phx-hook=".CommandAutocomplete"
          class="relative order-first min-w-0 basis-full flex-1 sm:order-none sm:basis-auto"
        >
          <input
            id="message-body"
            name={@message_form[:body].name}
            value={@message_form[:body].value}
            autocomplete="off"
            maxlength={Chat.Messages.max_body_length()}
            placeholder="Напиши сообщение..."
            class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
          />
          <div
            id="command-autocomplete-menu"
            role="listbox"
            aria-label="Команды чата"
            class="absolute bottom-full left-0 z-40 mb-2 hidden w-full overflow-hidden rounded-xl border border-amber-300/40 bg-zinc-900 shadow-2xl"
          >
            <button
              :for={
                {command, description} <- [
                  {"/помощь", "Список команд"},
                  {"/кто", "Кто сейчас в чате"},
                  {"/инфо ", "Открыть анкету"},
                  {"/игнор ", "Скрыть или вернуть чатланина"},
                  {"/игноры", "Список игноров"},
                  {"/выход", "Выйти из чата"}
                ]
              }
              type="button"
              role="option"
              data-command={command}
              class="command-autocomplete-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-amber-300/15"
            >
              <span class="font-semibold text-amber-200">{command}</span>
              <span class="text-zinc-400">{description}</span>
            </button>
          </div>
        </div>
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
      </fieldset>

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
      <script :type={Phoenix.LiveView.ColocatedHook} name=".CommandAutocomplete">
        export default {
          mounted() {
            this.input = this.el.querySelector("#message-body")
            this.menu = this.el.querySelector("#command-autocomplete-menu")
            this.items = [...this.menu.querySelectorAll("[data-command]")]
            this.selectedIndex = -1

            this.visibleItems = () => this.items.filter(item => !item.hidden)
            this.select = index => {
              const items = this.visibleItems()
              this.selectedIndex = items.length ? (index + items.length) % items.length : -1

              items.forEach((item, itemIndex) => {
                const selected = itemIndex === this.selectedIndex
                item.classList.toggle("bg-amber-300/15", selected)
                item.setAttribute("aria-selected", selected.toString())
              })
            }

            this.apply = item => {
              if (!item) return

              this.input.value = item.dataset.command
              this.input.dispatchEvent(new Event("input", {bubbles: true}))
              this.menu.classList.add("hidden")
              this.select(-1)
              this.input.focus()
            }

            this.refresh = () => {
              const query = this.input.value.trim().toLowerCase()
              const visible = query.startsWith("/")

              this.items.forEach(item => {
                item.hidden = !visible || !item.dataset.command.startsWith(query)
              })

              this.menu.classList.toggle("hidden", !visible || this.items.every(item => item.hidden))
              this.select(-1)
            }

            this.onInput = () => this.refresh()
            this.onClick = event => {
              const item = event.target.closest("[data-command]")
              if (!item) return

              this.apply(item)
            }

            this.onKeydown = event => {
              const items = this.visibleItems()
              const menuOpen = !this.menu.classList.contains("hidden")

              if (event.key === "Escape") {
                this.menu.classList.add("hidden")
                this.select(-1)
              } else if (menuOpen && event.key === "ArrowDown") {
                event.preventDefault()
                this.select(this.selectedIndex + 1)
              } else if (menuOpen && event.key === "ArrowUp") {
                event.preventDefault()
                this.select(this.selectedIndex - 1)
              } else if (menuOpen && event.key === "Tab") {
                event.preventDefault()
                this.apply(items[this.selectedIndex] || items[0])
              } else if (menuOpen && event.key === "Enter") {
                event.preventDefault()
                this.apply(items[this.selectedIndex] || items[0])
              }
            }

            this.input.addEventListener("input", this.onInput)
            this.input.addEventListener("keydown", this.onKeydown)
            this.menu.addEventListener("click", this.onClick)
          },
          destroyed() {
            this.input.removeEventListener("input", this.onInput)
            this.input.removeEventListener("keydown", this.onKeydown)
            this.menu.removeEventListener("click", this.onClick)
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
      assigns
      |> assign(
        :photo_url,
        Media.data_url(assigns.profile.photo, assigns.profile.photo_content_type)
      )
      |> assign(:rank, Ranks.for_user(assigns.profile.user))

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
            <div class="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
              <.rank_icon rank={@rank} class="size-4" />
              {@rank.title}
            </div>
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
            <div class="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-center text-xs">
              <div>
                <p class="text-lg font-semibold text-zinc-100">
                  {@profile.user.public_message_count}
                </p>
                <p class="text-zinc-500">публичных фраз</p>
              </div>
              <div>
                <p class="text-lg font-semibold text-zinc-100">
                  {div(@profile.user.chat_seconds, 3600)}
                </p>
                <p class="text-zinc-500">часов в чате</p>
              </div>
            </div>
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

  def settings_modal(assigns) do
    ~H"""
    <div
      id="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        id="settings-modal-backdrop"
        type="button"
        phx-click="toggle_settings"
        class="absolute inset-0 cursor-default"
        aria-label="Закрыть настройки"
      ></button>
      <section class="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Личный стиль
            </p>
            <h2 id="settings-modal-title" class="mt-1 text-2xl font-semibold text-white">
              Настройки
            </h2>
          </div>
          <button
            id="close-settings"
            type="button"
            phx-click="toggle_settings"
            class="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            aria-label="Закрыть настройки"
          >
            <.icon name="hero-x-mark" class="size-5" />
          </button>
        </div>
        <.settings_panel
          settings_form={@settings_form}
          themes={@themes}
          theme_id={@theme_id}
          theme_modes={@theme_modes}
          appearance={@appearance}
          nickname={@nickname}
        />
      </section>
    </div>
    """
  end

  defp settings_panel(assigns) do
    ~H"""
    <.form
      for={@settings_form}
      id="preferences-form"
      phx-change="preview_preferences"
      phx-submit="save_preferences"
      class="rounded border border-zinc-800 bg-zinc-950/70 p-3"
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

        <label class="block text-sm">
          <span class="mb-1 block text-zinc-400">Вид сообщения</span>
          <select
            id="message-frame"
            name="preferences[appearance][message_frame]"
            class="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
          >
            <option value="true" selected={Appearance.message_frame?(@appearance)}>
              В рамке · с реакциями
            </option>
            <option value="false" selected={not Appearance.message_frame?(@appearance)}>
              Строкой · без реакций
            </option>
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

        <div class={[
          "p-2 text-sm",
          Appearance.message_frame?(@appearance) &&
            "rounded border border-zinc-800 bg-zinc-900"
        ]}>
          <span class="chat-preview-nickname font-semibold" style={appearance_style(@appearance)}>
            {@nickname}{if Appearance.message_frame?(@appearance), do: "", else: ":"}
          </span>
          <span class="chat-preview-text" style={appearance_style(@appearance)}>пример текста</span>
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

  defp nickname_appearance_style(nickname, online) when is_binary(nickname) do
    case Enum.find(online, &(&1.nickname == nickname)) do
      %{appearance: appearance} -> appearance_style(appearance)
      _offline -> appearance_style(Appearance.default())
    end
  end

  defp format_file_size(size) when is_integer(size) and size >= 1_000_000 do
    "#{Float.round(size / 1_000_000, 1)} МБ"
  end

  defp format_file_size(size) when is_integer(size) and size >= 1_000 do
    "#{Float.round(size / 1_000, 1)} КБ"
  end

  defp format_file_size(size) when is_integer(size), do: "#{size} Б"
end
