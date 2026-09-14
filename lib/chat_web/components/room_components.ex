# Назначение файла: UI-компоненты комнаты чата: сообщения, список чатлан, настройки и нижний ввод.
defmodule ChatWeb.RoomComponents do
  use ChatWeb, :html

  alias Chat.Appearance
  alias Chat.Gifs
  alias Chat.Music
  alias Chat.Ranks
  alias Chat.Typography

  attr(:messages, :any, required: true)
  attr(:nickname, :string, required: true)
  attr(:peer_id, :string, required: true)
  attr(:appearance, :map, required: true)
  attr(:online, :list, required: true)
  attr(:emojis, :list, default: [])
  attr(:typing, :list, default: [])
  attr(:preserve_message_dom?, :boolean, default: false)

  def dialogue_frame(assigns) do
    ~H"""
    <main
      id="dialogue-frame"
      class="relative flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 md:border-b-0 md:border-r"
    >
      <div
        id="messages"
        phx-hook="ChatMessages"
        phx-update={if(@preserve_message_dom?, do: "ignore", else: "stream")}
        class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
      >
        <div
          :for={{dom_id, message} <- @messages}
          id={dom_id}
          data-message-id={message.id}
          data-client-id={Map.get(message, :client_id)}
          data-message-kind={Map.get(message, :kind, :text)}
          data-private={to_string(Map.get(message, :kind) == :private)}
          data-message-font={Typography.normalize_font_id(Map.get(message, :font_id))}
          data-message-font-style={Typography.normalize_font_style(Map.get(message, :font_style))}
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
              do: "ChatWeb.RoomComponents.ReactionBurst"
            )
          }
          class={[
            "chat-message-entry group/message relative transition-colors",
            Map.get(message, :kind) == :system && "px-3 py-0.5 text-center",
            Map.get(message, :kind) == :command && "px-1 py-1",
            Map.get(message, :kind) not in [:system, :command, :music] &&
              framed_message?(message, @appearance) &&
              "rounded border px-3 pb-2 pt-5 shadow-sm",
            Map.get(message, :kind) == :music &&
              framed_message?(message, @appearance) &&
              "w-full max-w-xl border-zinc-700 bg-zinc-950/90 px-3 py-2.5",
            Map.get(message, :kind) == :music && "ml-auto w-full max-w-xl",
            Map.get(message, :kind) == :gif && "ml-auto w-fit max-w-full",
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
            Map.get(message, :kind) not in [:private, :system, :music] &&
              framed_message?(message, @appearance) &&
              Map.get(message, :recipient) != @nickname &&
              "border-zinc-800 bg-zinc-900"
          ]}
        >
          <button
            :if={
              Map.get(message, :kind) not in [:system, :command, :music] &&
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
              Map.get(message, :kind) not in [:system, :command, :music] &&
                framed_message?(message, @appearance)
            }
            id={"message-time-#{dom_id}"}
            datetime={Map.get(message, :sent_at)}
            phx-hook=".LocalMessageTime"
            phx-update="ignore"
            class={[
              "absolute top-1 text-[10px] text-zinc-500",
              Map.get(message, :kind) == :text &&
                message.author == @nickname &&
                is_binary(Map.get(message, :client_id)) && "right-8",
              not (Map.get(message, :kind) == :text && message.author == @nickname &&
                     is_binary(Map.get(message, :client_id))) && "right-2"
            ]}
          >
            {message.at}
          </time>
          <span
            :if={
              Map.get(message, :kind) == :text &&
                message.author == @nickname &&
                is_binary(Map.get(message, :client_id))
            }
            id={"message-delivery-#{dom_id}"}
            data-delivery-state="published"
            class="absolute right-2 top-1 text-[11px] font-bold leading-none text-sky-400"
            aria-label="Опубликовано в истории"
          >
            <span aria-hidden="true">✓✓</span>
          </span>
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
              <%= if Map.get(message, :system_variant) == :features do %>
                <section
                  data-system-notice="features"
                  class="mx-auto my-2 max-w-xl rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/10 via-zinc-900 to-zinc-950 px-3 py-2.5 text-left shadow-lg shadow-black/20"
                >
                  <div class="flex items-center gap-2">
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-300/30 bg-amber-300/10 text-amber-200">
                      <.icon name="hero-sparkles" class="size-4" />
                    </span>
                    <p class="text-sm font-semibold text-amber-100">{message.title}</p>
                    <time
                      id={"message-time-#{dom_id}"}
                      datetime={Map.get(message, :sent_at)}
                      phx-hook=".LocalMessageTime"
                      phx-update="ignore"
                      class="ml-auto text-[10px] text-zinc-500"
                    >
                      {message.at}
                    </time>
                  </div>
                  <div class="mt-2.5 grid grid-cols-5 gap-1">
                    <div
                      :for={feature <- message.features}
                      class="flex min-w-0 flex-col items-center rounded-lg bg-zinc-950/55 px-1 py-2 text-center"
                    >
                      <.icon name={feature.icon} class="size-4 shrink-0 text-amber-200" />
                      <span class="mt-1 min-w-0 text-[10px] font-semibold leading-3 text-zinc-100">
                        {feature.label}
                      </span>
                      <span class="mt-0.5 min-w-0 text-[9px] leading-3 text-zinc-500">
                        {feature.text}
                      </span>
                    </div>
                  </div>
                </section>
              <% else %>
                <%= if Map.get(message, :system_variant) == :emoji_moderation do %>
                  <section
                    data-system-notice="emoji-moderation"
                    class="mx-auto my-2 flex max-w-xl items-center gap-3 rounded-2xl border border-sky-300/25 bg-sky-300/10 px-3 py-2.5 text-left shadow-lg shadow-black/20"
                  >
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/30 bg-sky-300/10 text-sky-200">
                      <.icon name="hero-shield-check" class="size-4" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-sky-100">
                        На проверке {message.pending_emoji_count} {emoji_count_label(
                          message.pending_emoji_count
                        )}
                      </p>
                      <p class="text-xs text-sky-100/70">
                        Откройте модерацию, чтобы проверить предложенные смайлы.
                      </p>
                    </div>
                    <a
                      href="/admin?section=emojis"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-auto shrink-0 rounded-lg border border-sky-200/40 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                      Проверить
                    </a>
                  </section>
                <% else %>
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
                <% end %>
              <% end %>
            <% :command -> %>
              <section
                class="rounded-xl border border-amber-300/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/20"
                data-command-result={message.command}
              >
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                  <.icon name="hero-command-line" class="size-4" />
                  <span>{message.title}</span>
                  <button
                    :if={message.command == :gif}
                    id={"dismiss-gif-search-#{dom_id}"}
                    type="button"
                    phx-click="dismiss_gif_search"
                    class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium normal-case tracking-normal text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    aria-label="Закрыть поиск GIF"
                  >
                    <.icon name="hero-x-mark" class="size-3.5" /> Закрыть
                  </button>
                  <button
                    :if={message.command == :music}
                    id={"dismiss-music-search-#{dom_id}"}
                    type="button"
                    phx-click="dismiss_music_search"
                    class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium normal-case tracking-normal text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    aria-label="Закрыть поиск музыки"
                  >
                    <.icon name="hero-x-mark" class="size-3.5" /> Закрыть
                  </button>
                  <time
                    id={"message-time-#{dom_id}"}
                    datetime={message.sent_at}
                    phx-hook=".LocalMessageTime"
                    phx-update="ignore"
                    class={[
                      "text-[10px] font-normal normal-case tracking-normal text-zinc-500",
                      message.command not in [:gif, :music] && "ml-auto"
                    ]}
                  >
                    {message.at}
                  </time>
                </div>
                <p class="mt-2 text-sm leading-5 text-zinc-300">{message.body}</p>
                <div
                  :if={message.entries != []}
                  class={
                    if message.command == :gif,
                      do: "mt-3 flex gap-2 overflow-x-auto pb-1",
                      else:
                        if(message.command == :music,
                          do: "mt-3 space-y-1.5",
                          else: "mt-3 flex flex-wrap gap-2"
                        )
                  }
                >
                  <%= for entry <- message.entries do %>
                    <button
                      :if={Map.get(entry, :type) == :gif}
                      id={"gif-result-#{dom_id}-#{entry.id}"}
                      type="button"
                      phx-click="send_gif"
                      phx-value-id={entry.id}
                      class="group/gif relative size-24 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left transition hover:border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:size-28"
                      aria-label={"Отправить GIF: #{entry.title}"}
                    >
                      <img
                        src={Gifs.proxy_url(entry.preview_url)}
                        alt={entry.title}
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        class="size-full object-cover transition duration-200 group-hover/gif:scale-[1.03]"
                      />
                      <span class="absolute inset-x-0 bottom-0 bg-zinc-950/75 px-1.5 py-1 text-center text-[10px] text-zinc-100 opacity-0 transition group-hover/gif:opacity-100">
                        Отправить GIF
                      </span>
                    </button>
                    <article
                      :if={Map.get(entry, :type) == :track}
                      id={"music-track-#{dom_id}-#{entry.id}"}
                      class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)_auto] sm:gap-3"
                    >
                      <div class="min-w-0 truncate text-xs leading-4 text-zinc-300">
                        <span class="font-semibold text-zinc-100">{entry.artist}</span>
                        <span class="text-zinc-500"> — </span>
                        <span>{entry.title}</span>
                        <span class="ml-1 text-[11px] text-zinc-500">{entry.duration}</span>
                      </div>
                      <audio
                        id={"music-player-#{dom_id}-#{entry.id}"}
                        controls
                        preload="none"
                        controlslist="nodownload"
                        src={Music.proxy_url(entry.audio_url)}
                        referrerpolicy="no-referrer"
                        aria-label={"Воспроизвести #{entry.artist} — #{entry.title}"}
                        class="col-span-2 h-8 w-full sm:col-span-1"
                      ></audio>
                      <button
                        id={"send-music-#{dom_id}-#{entry.id}"}
                        type="button"
                        phx-click="send_music"
                        phx-value-id={entry.id}
                        class="shrink-0 rounded-md border border-amber-300/50 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:border-amber-200 hover:bg-amber-300/10"
                      >
                        В чат
                      </button>
                    </article>
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
                <nav
                  :if={message.command == :music && Map.get(message, :music_pages, 1) > 1}
                  id={"music-pagination-#{dom_id}"}
                  class="mt-2 flex items-center justify-center gap-1.5"
                  aria-label="Страницы результатов музыки"
                >
                  <button
                    :for={page <- 1..message.music_pages}
                    id={"music-page-#{dom_id}-#{page}"}
                    type="button"
                    phx-click="change_music_page"
                    phx-value-page={page}
                    aria-current={if(page == message.music_page, do: "page", else: nil)}
                    class={[
                      "flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition",
                      page == message.music_page &&
                        "border-amber-200 bg-amber-300/15 text-amber-100",
                      page != message.music_page &&
                        "border-zinc-700 text-zinc-400 hover:border-amber-300/60 hover:text-amber-100"
                    ]}
                  >
                    {page}
                  </button>
                </nav>
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
            <% :gif -> %>
              <figure class="mt-2 max-w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
                <img
                  id={"gif-message-#{dom_id}"}
                  src={Gifs.proxy_url(message.media_url)}
                  alt={message.body}
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="max-h-48 w-full object-contain"
                />
                <figcaption class="px-2 py-1 text-xs text-zinc-500">
                  <button
                    :if={!framed_message?(message, @appearance)}
                    id={"message-author-#{dom_id}"}
                    type="button"
                    phx-hook="PrivateNickname"
                    data-private-nickname={message.author}
                    class="chat-message-author font-semibold hover:underline"
                    style={appearance_style(message)}
                  >
                    {message.author}:
                  </button>
                  <span :if={!framed_message?(message, @appearance)} class="mr-1"></span>
                  {message.body}
                </figcaption>
              </figure>
            <% :music -> %>
              <article class="max-w-xl">
                <div class="flex items-center justify-between gap-3 text-[11px] leading-4">
                  <button
                    id={"message-author-#{dom_id}"}
                    type="button"
                    phx-hook="PrivateNickname"
                    data-private-nickname={message.author}
                    class="chat-message-author min-w-0 truncate font-semibold hover:underline"
                    style={appearance_style(message)}
                  >
                    {message.author}
                  </button>
                  <time
                    id={"message-time-#{dom_id}"}
                    datetime={Map.get(message, :sent_at)}
                    phx-hook=".LocalMessageTime"
                    phx-update="ignore"
                    class="shrink-0 text-zinc-500"
                  >
                    {message.at}
                  </time>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200">
                    <.icon name="hero-musical-note" class="size-4" />
                  </span>
                  <span
                    class="shrink-0 text-base leading-none motion-safe:animate-spin motion-reduce:animate-none"
                    role="img"
                    aria-label="Музыка играет"
                    title="Музыка играет"
                  >
                    💿
                  </span>
                  <p class="min-w-0 flex-1 truncate text-sm text-zinc-300">
                    <span class="font-semibold text-zinc-100">{message.media_artist}</span>
                    <span class="text-zinc-500"> — </span>
                    <span>{message.body}</span>
                  </p>
                  <span class="shrink-0 text-xs text-emerald-200">{message.media_duration}</span>
                </div>
                <audio
                  id={"music-message-player-#{dom_id}"}
                  controls
                  preload="none"
                  controlslist="nodownload"
                  src={Music.proxy_url(message.media_url)}
                  referrerpolicy="no-referrer"
                  aria-label={"Воспроизвести #{message.media_artist} — #{message.body}"}
                  class="mt-2 h-9 w-full"
                ></audio>
              </article>
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
                      >{prefix}</strong>{whitespace}<.emoji_body body={body} emojis={@emojis} />
                    <% nil -> %>
                      <.emoji_body body={message.body} emojis={@emojis} />
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
                        >{prefix}</strong>{whitespace}<.emoji_body body={body} emojis={@emojis} />
                      <% nil -> %>
                        <.emoji_body body={message.body} emojis={@emojis} />
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
        <div
          id="pending-messages"
          phx-update="ignore"
          data-nickname={@nickname}
          aria-live="polite"
          class="order-last"
        >
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

  defp emoji_count_label(count) when rem(abs(count), 100) in 11..14, do: "смайлов"
  defp emoji_count_label(count) when rem(abs(count), 10) == 1, do: "смайл"
  defp emoji_count_label(count) when rem(abs(count), 10) in 2..4, do: "смайла"
  defp emoji_count_label(_count), do: "смайлов"

  defp typing_label([]), do: ""
  defp typing_label([nickname]), do: "#{nickname} печатает…"
  defp typing_label([first, second]), do: "#{first} и #{second} печатают…"
  defp typing_label(nicknames), do: "#{length(nicknames)} участника печатают…"

  defp reactable_message?(message) do
    Map.get(message, :kind, :text) in [:text, :gif] && message.author != "system"
  end

  defp framed_message?(%{kind: kind, author: author}, appearance)
       when kind in [:text, :gif] and author != "system",
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
  attr(:karmik_mood, :atom, default: :resting)

  def chatlan_sidebar(assigns) do
    ~H"""
    <aside class="hidden min-h-0 flex-col overflow-y-auto bg-zinc-900/80 p-4 md:block md:flex">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold leading-5">Сейчас в чате</h2>
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

      <div id="online-list" class="mt-4">
        <%= for user <- @online do %>
          <div
            id={"online-row-#{user.id}"}
            class="chat-online-row flex items-center gap-2 rounded px-2 py-0.5"
          >
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
              :if={not Map.get(user, :reconnecting?, false)}
              id={"private-message-#{user.id}"}
              type="button"
              phx-hook="PrivateNickname"
              data-private-nickname={user.nickname}
              class="chat-user-nickname min-w-0 flex-1 truncate text-left text-sm font-medium transition hover:underline"
              style={appearance_style(user)}
            >
              {user.nickname}
            </button>
            <span
              :if={Map.get(user, :reconnecting?, false)}
              class="min-w-0 flex-1 truncate text-sm font-medium"
              style={appearance_style(user)}
            >
              {user.nickname}
            </span>
            <.rank_badge rank={Map.get(user, :rank)} />
            <span
              class="shrink-0 text-[10px] font-medium"
              role={if(user.peer_id == @peer_id, do: "status")}
              aria-live={if(user.peer_id == @peer_id, do: "polite")}
            >
              <span
                :if={not Map.get(user, :busy?, false) and not Map.get(user, :reconnecting?, false)}
                id={if(user.peer_id == @peer_id, do: "current-chatlan-online")}
                class="chat-presence inline-flex items-center gap-1 text-emerald-300"
              >
                <span class="chat-presence-dot size-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_currentColor]"></span>
                В сети
              </span>
              <span
                :if={Map.get(user, :reconnecting?, false)}
                class="chat-presence inline-flex items-center gap-1 text-amber-300"
                aria-label={"#{user.nickname} переподключается"}
              >
                <.icon name="hero-arrow-path" class="size-3 motion-safe:animate-spin" />
                Переподключается
              </span>
              <span
                :if={Map.get(user, :bot?, false) && Map.get(user, :busy?, false)}
                id="bot-chatlan-busy"
                class="chat-presence inline-flex items-center gap-1 text-amber-300"
                aria-label="Хичкок занят"
              >
                <span class="chat-presence-dot size-1.5 rounded-full bg-amber-300"></span> Занят
              </span>
              <span
                id={if(user.peer_id == @peer_id, do: "current-chatlan-reconnecting")}
                class="chat-presence inline-flex items-center gap-1 text-amber-300"
                hidden
              >
                <.icon name="hero-arrow-path" class="size-3 motion-safe:animate-spin" /> Связь…
              </span>
            </span>
          </div>
        <% end %>
      </div>

      <section
        id="karmik"
        data-mood={@karmik_mood}
        class="karmik mt-auto hidden lg:flex"
        aria-label="Кармик, хранитель кармы чатлан"
      >
        <div
          id="karmik-sprite"
          phx-hook={if(@joined, do: "KarmikPet")}
          class="karmik-sprite"
          role="button"
          tabindex="0"
          aria-label="Погладить Кармика курсором"
          aria-describedby="karmik-name"
        >
        </div>
        <span :if={@karmik_mood == :happy} id="karmik-purr" class="karmik-purr" aria-live="polite">
          Мур-р-р!
        </span>
        <span id="karmik-name" class="karmik-tooltip" role="tooltip">Котик Кармик</span>
      </section>
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

  attr(:body, :string, required: true)
  attr(:emojis, :list, default: [])

  @url_regex ~r/(?:https?:\/\/|www\.)[^\s<>"']+/iu

  def emoji_body(assigns) do
    assigns = assign(assigns, :parts, emoji_parts(assigns.body, assigns.emojis))

    ~H"""
    <%= for part <- @parts do %>
      <span :if={part.type == :emoji} class="group relative inline-flex align-text-bottom">
        <img
          src={"/emojis/#{part.emoji.id}"}
          alt={part.emoji.code}
          title={part.emoji.code}
          width={part.emoji.width}
          height={part.emoji.height}
          class="h-auto w-auto max-h-16 max-w-24 object-contain"
        />
        <span
          role="tooltip"
          class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-52 -translate-x-1/2 rounded bg-zinc-950 px-2 py-1 text-xs text-zinc-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >{part.emoji.code}</span>
      </span>
      <%= if part.type == :text do %>
        <%= for text_part <- link_parts(part.text) do %>
          <a
            :if={text_part.type == :url}
            href={text_part.href}
            target="_blank"
            rel="noopener noreferrer"
            class="text-amber-200 underline decoration-amber-300/50 underline-offset-2 transition hover:text-amber-100"
          >{text_part.text}</a>
          <%= if text_part.type == :text do %>
            {text_part.text}
          <% end %>
        <% end %>
      <% end %>
    <% end %>
    """
  end

  defp emoji_parts(body, []), do: [%{type: :text, text: body}]

  defp emoji_parts(body, emojis) do
    by_code = Map.new(emojis, &{&1.code, &1})

    pattern =
      emojis
      |> Enum.map(&Regex.escape(&1.code))
      |> Enum.sort_by(&byte_size/1, :desc)
      |> Enum.join("|")

    regex = Regex.compile!("(#{pattern})")

    Regex.split(regex, body, include_captures: true, trim: false)
    |> Enum.reject(&(&1 == ""))
    |> Enum.map(fn part ->
      case by_code do
        %{^part => emoji} -> %{type: :emoji, emoji: emoji}
        _other -> %{type: :text, text: part}
      end
    end)
  end

  defp link_parts(text) do
    Regex.split(@url_regex, text, include_captures: true, trim: false)
    |> Enum.reject(&(&1 == ""))
    |> Enum.flat_map(fn part ->
      if Regex.match?(@url_regex, part) do
        url = String.trim_trailing(part, ".,!?;:")
        trailing_text = String.replace_prefix(part, url, "")
        href = if String.starts_with?(url, "www."), do: "https://" <> url, else: url

        [%{type: :url, text: url, href: href} | text_part(trailing_text)]
      else
        text_part(part)
      end
    end)
  end

  defp text_part(""), do: []
  defp text_part(text), do: [%{type: :text, text: text}]

  attr(:uploads, :any, required: true)
  attr(:error, :string, default: nil)

  def emoji_submission_modal(assigns) do
    ~H"""
    <div
      id="emoji-submission-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emoji-submission-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm"
    >
      <.form
        for={to_form(%{}, as: :emoji)}
        id="emoji-submission-form"
        phx-change="validate_emoji_submission"
        phx-submit="submit_emoji"
        class="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 id="emoji-submission-title" class="text-xl font-semibold text-white">
              Предложить смайл
            </h2><p class="mt-1 text-sm text-zinc-400">
              PNG, WebP или GIF до 3 МБ и 512×512 px. Анимированные файлы поддерживаются.
            </p>
          </div>
          <button
            id="close-emoji-submission"
            type="button"
            phx-click="close_emoji_submission"
            aria-label="Закрыть"
            class="text-zinc-400 hover:text-white"
          ><.icon name="hero-x-mark" class="size-5" /></button>
        </div>
        <p :if={@error} id="emoji-submission-error" role="alert" class="mt-4 text-sm text-red-300">
          {@error}
        </p>
        <div class="mt-5 space-y-4">
          <.input
            id="emoji-submission-code"
            field={to_form(%{}, as: :emoji)[:code]}
            type="text"
            label="Shortcode"
            placeholder="кот_плачет"
            required
          />
          <div
            id="emoji-shortcode-help"
            class="rounded-lg border border-zinc-700 bg-zinc-950/60 p-3 text-xs leading-5 text-zinc-400"
          >
            <p class="font-medium text-zinc-200">Как назвать смайл</p>
            <p>
              Введите название без двоеточий: <code>гляжу_котика</code>. В сообщении оно станет
              <code>:гляжу_котика:</code>
              и заменится картинкой.
            </p>
            <p class="mt-1">
              Используйте строчные русские или латинские буквы, цифры и <code>_</code>. Лучше коротко описывать эмоцию: <code>вау</code>, <code>кот_плачет</code>, <code>не_понял</code>.
            </p>
          </div>
          <.live_file_input
            upload={@uploads.emoji_image}
            id="emoji-submission-image"
            class="block w-full text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
          />
          <div
            :for={entry <- @uploads.emoji_image.entries}
            id={"emoji-upload-#{entry.ref}"}
            class="text-xs text-zinc-400"
          >
            {entry.client_name}
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            phx-click="close_emoji_submission"
            class="rounded px-4 py-2 text-sm text-zinc-300 hover:text-white"
          >Отмена</button><button
            type="submit"
            class="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200"
          >Отправить</button>
        </div>
      </.form>
    </div>
    """
  end

  attr(:message_form, :any, required: true)
  attr(:message_error, :string, default: nil)
  attr(:media_error, :string, default: nil)
  attr(:registered, :boolean, required: true)
  attr(:emojis, :list, default: [])
  attr(:peer_id, :string, required: true)
  attr(:ice_servers, :list, required: true)

  def message_input(assigns) do
    ~H"""
    <.form
      for={@message_form}
      id="message-form"
      phx-submit="send_message"
      phx-hook="PrivateMessageComposer"
      class="relative z-20 shrink-0 border-t border-zinc-800 bg-zinc-900 p-3 shadow-[0_-14px_28px_rgb(9_9_11_/_0.42)] transition"
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
        class="flex min-w-0 flex-wrap gap-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div class="contents">
          <button
            id="toggle-emoji-picker"
            type="button"
            phx-click={JS.toggle_class("emoji-picker-closed", to: "#emoji-picker")}
            aria-label="Выбрать смайл"
            aria-controls="emoji-picker"
            class="flex h-full min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 text-zinc-400 transition hover:border-amber-300 hover:text-amber-300"
          >
            <.icon name="hero-face-smile" class="size-5" />
          </button>
          <div
            id="emoji-picker"
            class="emoji-picker-closed order-first w-full min-w-0 max-w-full basis-full rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
          >
            <div
              id="emoji-picker-list"
              class="flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
            >
              <button
                :for={emoji <- @emojis}
                type="button"
                data-emoji-code={emoji.code}
                data-emoji-terms={Jason.encode!(emoji.suggestion_terms || [])}
                aria-label={"Вставить #{emoji.code}"}
                class="flex size-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-300/15 hover:scale-110"
              >
                <img
                  src={"/emojis/#{emoji.id}"}
                  alt={emoji.code}
                  width={emoji.width}
                  height={emoji.height}
                  class="h-auto w-auto max-h-8 max-w-8 object-contain"
                />
              </button>
              <p :if={@emojis == []} class="px-2 py-2 text-sm text-zinc-400">
                Смайлы появятся после модерации.
              </p>
            </div>
            <div class="mt-2 flex items-center justify-between gap-3 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
              <label class="flex items-center gap-2"><input
                id="emoji-autosuggest"
                type="checkbox"
                checked
              />Автоподбор</label>
              <button
                id="open-emoji-submission"
                type="button"
                phx-click="open_emoji_submission"
                class="text-amber-200 hover:text-amber-100"
              >Загрузить</button>
            </div>
          </div>
        </div>
        <button
          id="show-command-menu"
          type="button"
          phx-click={JS.dispatch("chat:open-command-menu", to: "#command-autocomplete")}
          aria-label="Открыть меню команд"
          aria-controls="command-autocomplete-menu"
          title="Команды"
          class="flex h-full min-h-10 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 font-mono text-base font-semibold text-zinc-400 transition hover:border-amber-300 hover:text-amber-300"
        >
          / <span class="sr-only">Команды</span>
        </button>
        <div class="order-first flex min-w-0 basis-full flex-1 gap-3 sm:contents">
          <div
            id="command-autocomplete"
            phx-hook=".CommandAutocomplete"
            class="relative min-w-0 flex-1"
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
            <input id="message-client-id" type="hidden" name="message[client_id]" value="" />
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
                    {"/музыка ", "Найти трек и открыть плеер"},
                    {"/гиф ", "Найти и отправить GIF"},
                    {"/очистить", "Очистить окно чата только у себя"},
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
          <button
            id="send-message"
            type="submit"
            phx-disable-with="Отправляем…"
            aria-label="Отправить сообщение"
            class="flex shrink-0 items-center justify-center rounded bg-amber-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 phx-submit-loading:cursor-wait phx-submit-loading:opacity-75 sm:px-4"
          >
            <.icon name="hero-paper-airplane" class="size-5 sm:hidden" />
            <span class="hidden sm:inline">Отправить</span>
          </button>
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
          id="leave-chat"
          type="button"
          phx-click={JS.dispatch("phx:clear-chat-session", to: "#chat-room") |> JS.push("leave_chat")}
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
            const input = this.el.querySelector("#message-body")
            const pickerList = this.el.querySelector("#emoji-picker-list")
            const autosuggest = this.el.querySelector("#emoji-autosuggest")

            const buttons = [...pickerList.querySelectorAll("[data-emoji-code]")]
            buttons.forEach((button, index) => {
              button.dataset.emojiOrder = index
              button.emojiTerms = JSON.parse(button.dataset.emojiTerms || "[]")
            })

            const reorder = () => {
              const text = input.value.toLocaleLowerCase()
              const score = button =>
                autosuggest.checked
                  ? button.emojiTerms.filter(term => term && text.includes(term)).length
                  : 0

              buttons
                .sort((a, b) => {
                  return score(b) - score(a) || Number(a.dataset.emojiOrder) - Number(b.dataset.emojiOrder)
                })
                .forEach(button => pickerList.append(button))
            }

            input.addEventListener("input", () => autosuggest.checked && reorder())
            autosuggest.addEventListener("change", reorder)

            this.el.addEventListener("click", event => {
              const emojiButton = event.target.closest("[data-emoji-code]")
              if (!emojiButton) return

              const start = input.selectionStart ?? input.value.length
              const end = input.selectionEnd ?? input.value.length
              input.setRangeText(emojiButton.dataset.emojiCode, start, end, "end")
              input.dispatchEvent(new Event("input", {bubbles: true}))
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
            this.open = () => {
              this.input.value = "/"
              this.input.dispatchEvent(new Event("input", {bubbles: true}))
              this.input.focus()
            }
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
            this.el.addEventListener("chat:open-command-menu", this.open)
          },
          destroyed() {
            this.input.removeEventListener("input", this.onInput)
            this.input.removeEventListener("keydown", this.onKeydown)
            this.menu.removeEventListener("click", this.onClick)
            this.el.removeEventListener("chat:open-command-menu", this.open)
          }
        }
      </script>
    </.form>
    """
  end

  attr(:profile, :any, required: true)
  attr(:form, :any, required: true)
  attr(:editable, :boolean, required: true)
  attr(:editing, :boolean, required: true)
  attr(:uploads, :map, required: true)

  def profile_modal(assigns) do
    assigns =
      assigns
      |> assign(
        :photo_url,
        profile_photo_url(assigns.profile)
      )
      |> assign(:rank, Ranks.for_user(assigns.profile.user))

    ~H"""
    <div
      id="profile-modal"
      phx-hook=".RoomProfilePhotoLightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm sm:p-6"
    >
      <button
        type="button"
        phx-click="close_profile"
        class="absolute inset-0"
        aria-label="Закрыть анкету"
      ></button>
      <section class="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-900 shadow-2xl shadow-black/40">
        <button
          id="close-profile"
          type="button"
          phx-click="close_profile"
          class="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-white/10 bg-zinc-950/70 text-zinc-300 shadow-lg backdrop-blur transition hover:border-amber-200/60 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-6 sm:top-6"
          aria-label="Закрыть анкету"
        >
          <.icon name="hero-x-mark" class="size-5" />
        </button>

        <div class="grid lg:min-h-[32rem] lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.35fr)]">
          <aside class="border-b border-white/10 bg-zinc-950/45 lg:border-b-0 lg:border-r">
            <%= if @photo_url && not (@uploads.profile_photo.entries != [] and @editing) do %>
              <button
                id="open-room-profile-photo"
                type="button"
                data-room-profile-lightbox-open
                aria-label={"Увеличить фото #{@profile.user.nickname}"}
                aria-haspopup="dialog"
                class="group/photo relative flex h-[min(30vh,18rem)] min-h-0 w-full cursor-zoom-in items-center justify-center overflow-hidden bg-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300 lg:h-full"
              >
                <img
                  id="profile-avatar-image"
                  src={@photo_url}
                  alt={"Фото #{@profile.user.nickname}"}
                  class="h-full w-full object-contain transition duration-300 group-hover/photo:scale-[1.02]"
                />
                <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent px-5 pb-5 pt-12 text-left text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                  <.icon name="hero-arrows-pointing-out" class="mr-2 inline size-4 align-text-bottom" />
                  Смотреть фото
                </span>
              </button>
            <% else %>
              <div class="grid h-[min(30vh,18rem)] place-items-center bg-gradient-to-br from-amber-300/15 via-zinc-950 to-zinc-950 text-6xl font-black text-amber-200 lg:h-full">
                <%= cond do %>
                  <% @uploads.profile_photo.entries != [] and @editing -> %>
                    <.live_img_preview
                      entry={List.first(@uploads.profile_photo.entries)}
                      class="h-full w-full object-contain"
                    />
                  <% true -> %>
                    {profile_initial(@profile.user.nickname)}
                <% end %>
              </div>
            <% end %>
          </aside>

          <div class="min-w-0">
            <header class="border-b border-white/10 bg-gradient-to-br from-amber-300/15 via-zinc-900 to-zinc-900 px-6 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-9">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Анкета</p>
              <h2
                id="profile-title"
                class="mt-2 truncate pr-12 text-4xl font-bold tracking-tight text-white sm:text-5xl"
              >
                {@profile.user.nickname}
              </h2>
              <p
                :if={present?(@profile.name)}
                id="profile-display-name"
                class="mt-2 truncate text-base font-medium text-zinc-300"
              >
                {@profile.name}
              </p>
              <div class="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/30 bg-zinc-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100">
                <.rank_icon rank={@rank} class="size-4 text-amber-300" />
                <span class="truncate">{@rank.title}</span>
              </div>
            </header>

            <div id="profile-view" class="space-y-5 p-6 sm:p-8">
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                  <div class="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    <.icon name="hero-chat-bubble-left-right" class="size-4 text-amber-300" /> Фразы
                  </div>
                  <p class="mt-2 text-3xl font-bold tabular-nums text-zinc-100">
                    {@profile.user.public_message_count}
                  </p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                  <div class="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    <.icon name="hero-clock" class="size-4 text-amber-300" /> В чате
                  </div>
                  <p class="mt-2 text-3xl font-bold tabular-nums text-zinc-100">
                    {div(@profile.user.chat_seconds, 3600)}
                  </p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-zinc-950/45 p-4">
                  <div class="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    <.icon name="hero-heart" class="size-4 text-rose-300" /> Карма
                  </div>
                  <p class="mt-2 text-3xl font-bold tabular-nums text-rose-100">
                    {@profile.user.karma}
                  </p>
                </div>
              </div>

              <div :if={@profile.birth_date || @profile.gender} class="flex flex-wrap gap-2">
                <span
                  :if={@profile.birth_date}
                  class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300"
                >
                  <.icon name="hero-cake" class="size-4 text-amber-300" />
                  {Calendar.strftime(@profile.birth_date, "%d.%m.%Y")}
                </span>
                <span
                  :if={@profile.gender}
                  class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-300"
                >
                  <.icon name="hero-user" class="size-4 text-amber-300" />
                  {profile_gender(@profile.gender)}
                </span>
              </div>

              <section class="min-h-36 rounded-2xl border border-white/10 bg-zinc-950/35 p-5">
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  <.icon name="hero-sparkles" class="size-4 text-amber-300" /> О себе
                </div>
                <p class={[
                  "mt-4 whitespace-pre-wrap text-sm leading-7",
                  present?(@profile.about) && "text-zinc-200",
                  !present?(@profile.about) && "italic text-zinc-500"
                ]}>
                  {if present?(@profile.about),
                    do: @profile.about,
                    else: "Пока ничего не рассказал о себе."}
                </p>
              </section>

              <button
                :if={@editable and not @editing}
                id="edit-profile"
                type="button"
                phx-click="edit_profile"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 font-semibold text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-300/15"
              >
                <.icon name="hero-pencil-square" class="size-5" /> Редактировать анкету
              </button>
            </div>

            <.form
              :if={@editable and @editing}
              for={@form}
              id="profile-form"
              phx-change="validate_profile"
              phx-submit="save_profile"
              class="space-y-5 border-t border-zinc-800 bg-zinc-950/40 p-5 sm:p-7"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                    Твоя анкета
                  </p>
                  <h3 class="mt-1 text-xl font-bold text-white">Редактирование</h3>
                </div>
                <button
                  id="cancel-profile-edit"
                  type="button"
                  phx-click="cancel_profile_edit"
                  class="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >Отмена</button>
              </div>

              <div id="profile-photo-compressor" phx-hook=".ProfilePhotoCompressor">
                <label for="profile-photo-input" class="text-sm font-semibold text-zinc-200">Фотография</label>
                <.live_file_input
                  id="profile-photo-input"
                  upload={@uploads.profile_photo}
                  class="mt-2 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-300 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
                />
                <p class="mt-2 text-xs leading-4 text-zinc-500">
                  JPG, PNG или WebP. Фото будет уменьшено до 1280×1280.
                </p>
                <p
                  :if={upload_errors(@uploads.profile_photo) != []}
                  id="profile-photo-error"
                  class="mt-2 text-xs text-red-300"
                >
                  Фото должно быть подходящего формата и не больше 1,5 МБ.
                </p>
              </div>

              <.input field={@form[:name]} label="Имя" maxlength="80" />
              <div class="grid gap-4 sm:grid-cols-2">
                <.input field={@form[:birth_date]} type="date" label="Дата рождения" />
                <.input
                  field={@form[:gender]}
                  type="select"
                  label="Пол"
                  prompt="Не указан"
                  options={[{"Мужской", "male"}, {"Женский", "female"}, {"Другой", "other"}]}
                />
              </div>
              <.input field={@form[:about]} type="textarea" label="О себе" maxlength="1000" />
              <button
                id="save-profile"
                type="submit"
                class="w-full rounded-xl bg-amber-300 px-4 py-3.5 font-semibold text-zinc-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-50"
              >Сохранить изменения</button>
            </.form>
          </div>
        </div>

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

      <div
        id="room-profile-photo-lightbox"
        phx-update="ignore"
        role="dialog"
        aria-modal="true"
        aria-hidden="true"
        aria-labelledby="room-profile-photo-lightbox-title"
        inert
        class="pointer-events-none invisible absolute inset-0 z-20 flex items-center justify-center p-4 opacity-0 transition duration-200 sm:p-8"
      >
        <button
          type="button"
          data-room-profile-lightbox-close
          aria-label="Закрыть увеличенное фото"
          class="absolute inset-0 cursor-zoom-out bg-zinc-950/90 backdrop-blur-md"
        ></button>
        <figure class="relative z-10 flex max-h-full max-w-full flex-col items-center gap-4">
          <img
            id="room-profile-photo-lightbox-image"
            src=""
            alt=""
            class="max-h-[calc(100vh-8rem)] max-w-[min(92vw,90rem)] scale-95 rounded-2xl object-contain shadow-2xl ring-1 ring-white/10 transition duration-200"
          />
          <figcaption id="room-profile-photo-lightbox-title" class="text-center text-sm text-zinc-300">
            Просмотр фотографии
          </figcaption>
        </figure>
        <button
          id="close-room-profile-photo-lightbox"
          type="button"
          data-room-profile-lightbox-close
          aria-label="Закрыть"
          class="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-zinc-100 shadow-xl backdrop-blur-sm transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-7 sm:top-7"
        >
          <.icon name="hero-x-mark" class="size-6" />
        </button>
      </div>

      <script :type={Phoenix.LiveView.ColocatedHook} name=".RoomProfilePhotoLightbox">
        export default {
          mounted() {
            this.lightbox = this.el.querySelector("#room-profile-photo-lightbox")
            this.image = this.el.querySelector("#room-profile-photo-lightbox-image")
            this.title = this.el.querySelector("#room-profile-photo-lightbox-title")
            this.closeButton = this.el.querySelector("#close-room-profile-photo-lightbox")

            this.open = button => {
              const sourceImage = button.querySelector("img")
              if (!sourceImage) return

              this.previousFocus = button
              this.image.src = sourceImage.currentSrc || sourceImage.src
              this.image.alt = sourceImage.alt
              this.title.textContent = sourceImage.alt
              this.lightbox.inert = false
              this.lightbox.setAttribute("aria-hidden", "false")
              this.lightbox.classList.remove("pointer-events-none", "invisible", "opacity-0")
              this.lightbox.classList.add("opacity-100")
              this.image.classList.replace("scale-95", "scale-100")
              this.closeButton.focus()
            }

            this.close = () => {
              if (this.lightbox.getAttribute("aria-hidden") === "true") return

              this.lightbox.setAttribute("aria-hidden", "true")
              this.lightbox.classList.add("pointer-events-none", "invisible", "opacity-0")
              this.lightbox.classList.remove("opacity-100")
              this.image.classList.replace("scale-100", "scale-95")
              this.image.removeAttribute("src")
              this.previousFocus?.focus()
            }

            this.onClick = event => {
              const openButton = event.target.closest("[data-room-profile-lightbox-open]")
              if (openButton) this.open(openButton)

              const closeButton = event.target.closest("[data-room-profile-lightbox-close]")
              if (closeButton && this.lightbox.contains(closeButton)) this.close()
            }
            this.onKeydown = event => {
              if (event.key === "Escape") this.close()
            }
            this.el.addEventListener("click", this.onClick)
            document.addEventListener("keydown", this.onKeydown)
          },
          destroyed() {
            document.removeEventListener("keydown", this.onKeydown)
          }
        }
      </script>
    </div>
    """
  end

  defp profile_photo_url(%{photo: nil, photo_key: nil}), do: nil
  defp profile_photo_url(%{user: %{nickname: nickname}}), do: ~p"/profiles/#{nickname}/photo"

  defp present?(value) when is_binary(value), do: String.trim(value) != ""
  defp present?(_value), do: false

  defp profile_initial(nickname) do
    nickname
    |> String.graphemes()
    |> List.first()
    |> to_string()
    |> String.upcase()
  end

  defp profile_gender("male"), do: "Мужской"
  defp profile_gender("female"), do: "Женский"
  defp profile_gender("other"), do: "Другой"
  defp profile_gender(_gender), do: "Не указан"

  attr(:settings_form, :any, required: true)
  attr(:themes, :list, required: true)
  attr(:theme_id, :string, required: true)
  attr(:theme_modes, :list, required: true)
  attr(:appearance, :map, required: true)
  attr(:fonts, :list, required: true)
  attr(:font_id, :string, required: true)
  attr(:font_styles, :list, required: true)
  attr(:font_style, :string, required: true)
  attr(:message_sound_enabled, :boolean, required: true)
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
      <section class="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Личный стиль
            </p>
            <h2 id="settings-modal-title" class="mt-1 text-2xl font-semibold text-zinc-100">
              Настройки
            </h2>
            <p class="mt-1 text-sm text-zinc-400">Настрой чат под себя.</p>
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
        <div class="p-5 sm:p-6">
          <.settings_panel
            settings_form={@settings_form}
            themes={@themes}
            theme_id={@theme_id}
            theme_modes={@theme_modes}
            appearance={@appearance}
            fonts={@fonts}
            font_id={@font_id}
            font_styles={@font_styles}
            font_style={@font_style}
            message_sound_enabled={@message_sound_enabled}
            nickname={@nickname}
          />
        </div>
      </section>
    </div>
    """
  end

  attr(:form, :any, required: true)
  attr(:registered, :boolean, required: true)
  attr(:nickname, :string, default: nil)

  def feedback_modal(assigns) do
    ~H"""
    <div
      id="feedback-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        id="feedback-modal-backdrop"
        type="button"
        phx-click="close_feedback"
        class="absolute inset-0 cursor-default"
        aria-label="Закрыть форму обратной связи"
      ></button>
      <section class="relative z-10 w-full max-w-lg rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Vertigo</p>
            <h2 id="feedback-modal-title" class="mt-1 text-2xl font-semibold text-white">
              Обратная связь
            </h2>
            <p class="mt-2 text-sm leading-5 text-zinc-400">
              Расскажи, что стоит улучшить в чате.
            </p>
          </div>
          <button
            id="close-feedback"
            type="button"
            phx-click="close_feedback"
            class="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            aria-label="Закрыть форму обратной связи"
          >
            <.icon name="hero-x-mark" class="size-5" />
          </button>
        </div>
        <.form
          for={@form}
          id="feedback-form"
          phx-change="validate_feedback"
          phx-submit="submit_feedback"
          class="space-y-4"
        >
          <.input
            :if={not @registered}
            field={@form[:name]}
            type="text"
            label="Твоё имя"
            autocomplete="name"
            maxlength="40"
            required
          />
          <p :if={@registered} class="text-sm text-zinc-400">
            Отправим от имени <span class="font-semibold text-zinc-100">{@nickname}</span>.
          </p>
          <.input
            field={@form[:body]}
            type="textarea"
            label="Пожелание"
            maxlength="2000"
            required
            placeholder="Например: добавьте поиск по сообщениям…"
          />
          <div class="flex justify-end gap-3">
            <button
              id="cancel-feedback"
              type="button"
              phx-click="close_feedback"
              class="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
            >
              Отмена
            </button>
            <button
              id="submit-feedback"
              type="submit"
              class="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
            >
              Отправить
            </button>
          </div>
        </.form>
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
      class="space-y-4"
    >
      <section class="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <div class="mb-3 flex items-center gap-2">
          <.icon name="hero-swatch" class="size-4 text-amber-300" />
          <h3 class="text-sm font-semibold text-zinc-100">Интерфейс</h3>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1 block text-zinc-400">Тема</span>
            <select
              id="theme-id"
              name={@settings_form[:theme_id].name}
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
            >
              <%= for theme <- @themes do %>
                <option value={theme.id} selected={theme.id == @theme_id}>
                  {theme.name} · {if theme.mode == "light", do: "Светлая", else: "Тёмная"}
                </option>
              <% end %>
            </select>
          </label>

          <label class="block text-sm sm:col-span-2">
            <span class="mb-1 block text-zinc-400">Вид сообщений</span>
            <select
              id="message-frame"
              name="preferences[appearance][message_frame]"
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
            >
              <option value="true" selected={Appearance.message_frame?(@appearance)}>
                В рамке · с реакциями
              </option>
              <option value="false" selected={not Appearance.message_frame?(@appearance)}>
                Строкой · без реакций
              </option>
            </select>
          </label>
        </div>
      </section>

      <section class="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <div class="mb-3 flex items-center gap-2">
          <.icon name="hero-chat-bubble-left-right" class="size-4 text-amber-300" />
          <div>
            <h3 class="text-sm font-semibold text-zinc-100">Мои сообщения</h3>
            <p class="text-xs text-zinc-500">Шрифт увидят только собеседники в твоих сообщениях.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1 block text-zinc-400">Шрифт</span>
            <select
              id="font-id"
              name={@settings_form[:font_id].name}
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
            >
              <%= for font <- @fonts do %>
                <option value={font.id} selected={font.id == @font_id}>{font.name}</option>
              <% end %>
            </select>
          </label>

          <label class="block text-sm">
            <span class="mb-1 block text-zinc-400">Начертание</span>
            <select
              id="font-style"
              name={@settings_form[:font_style].name}
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
            >
              <%= for style <- @font_styles do %>
                <option value={style.id} selected={style.id == @font_style}>{style.name}</option>
              <% end %>
            </select>
          </label>
        </div>
      </section>

      <section class="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
        <label class="flex cursor-pointer items-center gap-3">
          <input type="hidden" name={@settings_form[:message_sound_enabled].name} value="false" />
          <input
            id="message-sound-enabled"
            type="checkbox"
            name={@settings_form[:message_sound_enabled].name}
            value="true"
            checked={@message_sound_enabled}
            class="peer sr-only"
          />
          <span class="relative flex h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition peer-checked:bg-amber-300 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-zinc-100">Звуковые уведомления</span>
            <span class="mt-0.5 block text-xs leading-4 text-zinc-500">Личные сообщения и обращения по нику.</span>
          </span>
        </label>
      </section>

      <details
        id="appearance-colors"
        phx-update="ignore"
        class="group rounded-2xl border border-zinc-800 bg-zinc-950/70"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-100 marker:content-none">
          <.icon name="hero-paint-brush" class="size-4 text-amber-300" /> Цвета моих сообщений
          <span class="ml-auto text-xs font-normal text-zinc-500">Дополнительно</span>
          <.icon
            name="hero-chevron-down"
            class="size-4 text-zinc-500 transition group-open:rotate-180"
          />
        </summary>
        <div class="space-y-3 border-t border-zinc-800 p-4">
          <p class="text-xs leading-4 text-zinc-500">Отдельные цвета для светлых и тёмных тем.</p>
          <%= for mode <- @theme_modes do %>
            <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p class="mb-2 text-xs font-semibold text-zinc-400">{mode.name}</p>
              <div class="grid grid-cols-2 gap-3">
                <label class="block text-sm">
                  <span class="mb-1 block text-zinc-400">Ник</span>
                  <input
                    id={"#{mode.id}-nickname-color"}
                    type="color"
                    name={"preferences[appearance][#{mode.id}][nickname_color]"}
                    value={mode_colors(@appearance, mode.id)["nickname_color"]}
                    class="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
                  />
                </label>

                <label class="block text-sm">
                  <span class="mb-1 block text-zinc-400">Текст</span>
                  <input
                    id={"#{mode.id}-text-color"}
                    type="color"
                    name={"preferences[appearance][#{mode.id}][text_color]"}
                    value={mode_colors(@appearance, mode.id)["text_color"]}
                    class="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
                  />
                </label>
              </div>
            </div>
          <% end %>
        </div>
      </details>

      <section
        class={[
          "chat-message-entry rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm",
          !Appearance.message_frame?(@appearance) && "border-transparent bg-transparent px-0"
        ]}
        data-message-font={@font_id}
        data-message-font-style={@font_style}
      >
        <p class="mb-1 text-xs font-medium text-zinc-500">Предпросмотр</p>
        <span class="chat-preview-nickname font-semibold" style={appearance_style(@appearance)}>
          {@nickname}{if Appearance.message_frame?(@appearance), do: "", else: ":"}
        </span>
        <span class="chat-preview-text" style={appearance_style(@appearance)}> пример текста</span>
      </section>

      <button
        id="save-preferences"
        type="submit"
        class="w-full rounded-xl bg-amber-300 px-3 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
      >
        Сохранить изменения
      </button>
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
