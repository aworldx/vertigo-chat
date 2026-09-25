# Назначение файла: контекст публичных сообщений, их создание, подписка и realtime-публикация.
defmodule Chat.Messages do
  @moduledoc """
  Public chat message context.

  This module owns message creation, realtime publication and the bounded
  persistent history of public room messages.
  """

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Appearance
  alias Chat.Gifs
  alias Chat.Music
  alias Chat.Messages.Registry
  alias Chat.Messages.History
  alias Chat.Ranks
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes
  alias Chat.Typography
  alias Chat.YouTube

  @default_room_id "lobby"
  @max_body_length 1_000
  @reaction_emojis ["👍", "❤️", "😂", "😮", "😢", "🔥"]

  def subscribe(room_id \\ @default_room_id) do
    Phoenix.PubSub.subscribe(Chat.PubSub, room_topic(room_id))
  end

  def send_public_message(author, room_id \\ @default_room_id, attrs) do
    send_public_message(author, room_id, attrs, Subject.internal({room_id, author}))
  end

  def send_registered_public_message(%User{} = user, room_id, attrs, %Subject{} = subject) do
    case Map.get(attrs, "body") do
      body when is_binary(body) ->
        deliver_registered_message(
          user,
          room_id,
          body,
          Themes.normalize_theme_id(Map.get(attrs, "theme_id")),
          Appearance.normalize(Map.get(attrs, "appearance")),
          Typography.normalize_font_id(Map.get(attrs, "font_id")),
          Typography.normalize_font_style(Map.get(attrs, "font_style")),
          Map.get(attrs, "recipient_nicknames", []),
          Map.get(attrs, "client_id"),
          subject
        )

      _body ->
        {:error, :invalid_message}
    end
  end

  def send_public_message(author, room_id, attrs, subject)

  def send_public_message(
        author,
        room_id,
        %{
          "body" => body,
          "theme_id" => theme_id,
          "appearance" => appearance
        } = attrs,
        %Subject{} = subject
      )
      when is_binary(body) do
    deliver_message(
      author,
      room_id,
      body,
      Themes.normalize_theme_id(theme_id),
      Appearance.normalize(appearance),
      Typography.normalize_font_id(Map.get(attrs, "font_id")),
      Typography.normalize_font_style(Map.get(attrs, "font_style")),
      Map.get(attrs, "recipient_nicknames", []),
      Map.get(attrs, "rank"),
      Map.get(attrs, "client_id"),
      subject
    )
  end

  def send_public_message(author, room_id, %{"body" => body} = attrs, %Subject{} = subject)
      when is_binary(body) do
    deliver_message(
      author,
      room_id,
      body,
      Themes.default_theme_id(),
      Appearance.default(),
      Typography.default_font_id(),
      Typography.default_font_style(),
      Map.get(attrs, "recipient_nicknames", []),
      Map.get(attrs, "rank"),
      Map.get(attrs, "client_id"),
      subject
    )
  end

  def send_public_message(_author, _room_id, _attrs, %Subject{}),
    do: {:error, :invalid_message}

  def send_gif(author, room_id, gif, attrs, %Subject{} = subject)
      when is_binary(author) and is_binary(room_id) and is_map(gif) and is_map(attrs) do
    with {:ok, gif} <- normalize_gif(gif),
         :ok <- allow_gif_message(subject) do
      broadcast_gif(author, room_id, gif, attrs, nil)
    end
  end

  def send_gif(_author, _room_id, _gif, _attrs, %Subject{}), do: {:error, :invalid_gif}

  def send_registered_gif(
        %User{id: user_id} = user,
        room_id,
        gif,
        attrs,
        %Subject{actor_id: user_id} = subject
      )
      when is_binary(room_id) and is_map(gif) and is_map(attrs) do
    with {:ok, gif} <- normalize_gif(gif),
         :ok <- allow_gif_message(subject),
         {:ok, updated_user} <- Ranks.public_message_sent(user),
         {:ok, message} <-
           broadcast_gif(updated_user.nickname, room_id, gif, attrs, Ranks.for_user(updated_user)) do
      {:ok, message, updated_user}
    end
  end

  def send_registered_gif(_user, _room_id, _gif, _attrs, %Subject{}),
    do: {:error, :invalid_gif}

  def send_music(author, room_id, track, attrs, %Subject{} = subject)
      when is_binary(author) and is_binary(room_id) and is_map(track) and is_map(attrs) do
    with {:ok, track} <- Music.normalize_track(track),
         :ok <- allow_music_message(subject) do
      broadcast_music(author, room_id, track, attrs, nil)
    end
  end

  def send_music(_author, _room_id, _track, _attrs, %Subject{}), do: {:error, :invalid_track}

  def send_registered_music(
        %User{id: user_id} = user,
        room_id,
        track,
        attrs,
        %Subject{actor_id: user_id} = subject
      )
      when is_binary(room_id) and is_map(track) and is_map(attrs) do
    with {:ok, track} <- Music.normalize_track(track),
         :ok <- allow_music_message(subject),
         {:ok, updated_user} <- Ranks.public_message_sent(user),
         {:ok, message} <-
           broadcast_music(
             updated_user.nickname,
             room_id,
             track,
             attrs,
             Ranks.for_user(updated_user)
           ) do
      {:ok, message, updated_user}
    end
  end

  def send_registered_music(_user, _room_id, _track, _attrs, %Subject{}),
    do: {:error, :invalid_track}

  def send_youtube(author, room_id, link, attrs, %Subject{} = subject)
      when is_binary(author) and is_binary(room_id) and is_binary(link) and is_map(attrs) do
    with {:ok, video} <- YouTube.prepare_video(link),
         :ok <- allow_youtube_message(subject) do
      broadcast_youtube(author, room_id, video, attrs, nil)
    end
  end

  def send_youtube(_author, _room_id, _link, _attrs, %Subject{}), do: {:error, :invalid_youtube}

  def send_registered_youtube(
        %User{id: user_id} = user,
        room_id,
        link,
        attrs,
        %Subject{actor_id: user_id} = subject
      )
      when is_binary(room_id) and is_binary(link) and is_map(attrs) do
    with {:ok, video} <- YouTube.prepare_video(link),
         :ok <- allow_youtube_message(subject),
         {:ok, updated_user} <- Ranks.public_message_sent(user),
         {:ok, message} <-
           broadcast_youtube(
             updated_user.nickname,
             room_id,
             video,
             attrs,
             Ranks.for_user(updated_user)
           ) do
      {:ok, message, updated_user}
    end
  end

  def send_registered_youtube(_user, _room_id, _link, _attrs, %Subject{}),
    do: {:error, :invalid_youtube}

  def list_recent_messages(room_id \\ @default_room_id) do
    case History.list_recent(room_id) do
      [] ->
        [welcome_message()]

      messages ->
        :ok = Registry.replace(room_id, messages)
        messages
    end
  end

  def list_messages_after(room_id, message_id)
      when is_binary(room_id) and is_integer(message_id) do
    History.list_after(room_id, message_id)
  end

  def list_messages_after(_room_id, _message_id), do: []

  def list_text_messages_before(room_id, message_id),
    do: History.list_text_before(room_id, message_id)

  def announce_presence(nickname, room_id, event)
      when is_binary(nickname) and is_binary(room_id) and event in [:joined, :left] do
    body =
      if event == :joined, do: "в чат заходит #{nickname}", else: "из чата выходит #{nickname}"

    message =
      Map.merge(
        %{
          id: System.unique_integer([:positive]),
          kind: :system,
          author: "system",
          body: body,
          recipient: nil,
          reactions: %{},
          theme_id: Themes.default_theme_id(),
          appearance: Appearance.default()
        },
        timestamp()
      )

    persist_and_broadcast(room_id, message)
  end

  @doc "Persists a departure inside the caller's session transaction."
  def persist_departure(nickname, room_id) do
    message =
      Map.merge(
        %{
          kind: :system,
          author: "system",
          body: "из чата выходит #{nickname}",
          theme_id: Themes.default_theme_id(),
          appearance: Appearance.default(),
          reactions: %{}
        },
        timestamp()
      )

    with {:ok, saved, :inserted} <- History.save(room_id, message), do: {:ok, saved}
  end

  def broadcast_persisted(room_id, message) do
    :ok = Registry.append(room_id, message)
    Phoenix.PubSub.broadcast(Chat.PubSub, room_topic(room_id), {:message_created, message})
  end

  def announce_karmik_assessment(nickname, room_id, 1)
      when is_binary(nickname) and is_binary(room_id) do
    announce_system(room_id, "Кармик дарит для #{nickname} сердечко — рейтинг повышен на 1.")
  end

  def announce_karmik_assessment(nickname, room_id, -1)
      when is_binary(nickname) and is_binary(room_id) do
    announce_system(room_id, "Кармик сердито машет хвостом: #{nickname}, рейтинг понижен на 1.")
  end

  def toggle_reaction(reactor, reactor_key, room_id, message_id, emoji)
      when is_binary(reactor) and is_binary(reactor_key) and is_binary(room_id) and
             is_binary(message_id) and emoji in @reaction_emojis do
    case Registry.toggle_reaction(room_id, message_id, reactor, reactor_key, emoji) do
      {:ok, message} ->
        :ok = History.update_reactions(room_id, message.id, message.reactions)

        :ok =
          Phoenix.PubSub.broadcast(
            Chat.PubSub,
            room_topic(room_id),
            {:message_reacted, message}
          )

        {:ok, message}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def toggle_reaction(_reactor, _reactor_key, _room_id, _message_id, _emoji),
    do: {:error, :invalid_reaction}

  @doc "Deletes a user-authored public message and notifies every room subscriber."
  def delete_for_everyone(%User{} = user, room_id, message_id)
      when is_binary(room_id) and is_integer(message_id) do
    with true <- Accounts.admin?(user),
         {:ok, message} <- History.delete_moderatable(room_id, message_id) do
      :ok = Registry.remove(room_id, message_id)

      :ok =
        Phoenix.PubSub.broadcast(
          Chat.PubSub,
          room_topic(room_id),
          {:message_deleted, message.id}
        )

      {:ok, message}
    else
      false -> {:error, :unauthorized}
      :not_found -> {:error, :message_unavailable}
      {:error, reason} -> {:error, reason}
    end
  end

  def delete_for_everyone(_user, _room_id, _message_id), do: {:error, :unauthorized}

  defp welcome_message do
    Map.merge(
      %{
        id: "welcome-1",
        kind: :text,
        author: "system",
        body: "Добро пожаловать в чат!",
        recipient: nil,
        theme_id: Themes.default_theme_id(),
        appearance: Appearance.default()
      },
      timestamp()
    )
  end

  defp announce_system(room_id, body) do
    message =
      Map.merge(
        %{
          id: System.unique_integer([:positive]),
          kind: :system,
          author: "Кармик",
          body: body,
          recipient: nil,
          reactions: %{},
          theme_id: Themes.default_theme_id(),
          appearance: Appearance.default()
        },
        timestamp()
      )

    persist_and_broadcast(room_id, message)
  end

  def room_topic(room_id), do: "room:#{room_id}"

  def max_body_length, do: @max_body_length
  def reaction_emojis, do: @reaction_emojis

  defp deliver_message(
         author,
         room_id,
         body,
         theme_id,
         appearance,
         font_id,
         font_style,
         recipient_nicknames,
         rank,
         client_id,
         subject
       ) do
    body = String.trim(body)
    author_identity = author_identity(subject, author)

    cond do
      body == "" ->
        {:error, :empty_body}

      String.length(body) > @max_body_length ->
        {:error, :message_too_long}

      true ->
        case History.find_by_client_id(room_id, author_identity, valid_client_id(client_id)) do
          {:ok, message} ->
            {:ok, message}

          :not_found ->
            case Security.allow_message(subject) do
              :ok ->
                broadcast_message(
                  author,
                  room_id,
                  body,
                  theme_id,
                  appearance,
                  font_id,
                  font_style,
                  recipient_nicknames,
                  rank,
                  client_id,
                  author_identity
                )

              {:error, {:rate_limited, _retry_after_ms}} ->
                {:error, :rate_limited}
            end
        end
    end
  end

  defp broadcast_message(
         author,
         room_id,
         body,
         theme_id,
         appearance,
         font_id,
         font_style,
         recipient_nicknames,
         rank,
         client_id,
         author_identity
       ) do
    message =
      build_message(
        author,
        body,
        theme_id,
        appearance,
        font_id,
        font_style,
        recipient_nicknames,
        rank,
        client_id,
        author_identity
      )

    persist_and_broadcast(room_id, message)
  end

  defp broadcast_gif(author, room_id, gif, attrs, rank) do
    message =
      build_gif_message(
        author,
        gif,
        Themes.normalize_theme_id(Map.get(attrs, "theme_id")),
        Appearance.normalize(Map.get(attrs, "appearance") || %{}),
        Typography.normalize_font_id(Map.get(attrs, "font_id")),
        Typography.normalize_font_style(Map.get(attrs, "font_style")),
        rank
      )

    persist_and_broadcast(room_id, message)
  end

  defp broadcast_music(author, room_id, track, attrs, rank) do
    message =
      build_music_message(
        author,
        track,
        Themes.normalize_theme_id(Map.get(attrs, "theme_id")),
        Appearance.normalize(Map.get(attrs, "appearance") || %{}),
        Typography.normalize_font_id(Map.get(attrs, "font_id")),
        Typography.normalize_font_style(Map.get(attrs, "font_style")),
        rank
      )

    persist_and_broadcast(room_id, message)
  end

  defp broadcast_youtube(author, room_id, video, attrs, rank) do
    message =
      build_youtube_message(
        author,
        video,
        Themes.normalize_theme_id(Map.get(attrs, "theme_id")),
        Appearance.normalize(Map.get(attrs, "appearance") || %{}),
        Typography.normalize_font_id(Map.get(attrs, "font_id")),
        Typography.normalize_font_style(Map.get(attrs, "font_style")),
        rank
      )

    persist_and_broadcast(room_id, message)
  end

  defp persist_and_broadcast(room_id, message) do
    with {:ok, message, :inserted} <- History.save(room_id, message) do
      :ok = Registry.append(room_id, message)

      Chat.Metrics.increment(:public_messages, %{kind: message.kind})

      :ok =
        Phoenix.PubSub.broadcast(Chat.PubSub, room_topic(room_id), {:message_created, message})

      {:ok, message}
    else
      {:ok, message, :existing} -> {:ok, message}
      {:error, reason} -> {:error, reason}
    end
  end

  defp deliver_registered_message(
         user,
         room_id,
         body,
         theme_id,
         appearance,
         font_id,
         font_style,
         recipients,
         client_id,
         subject
       ) do
    body = String.trim(body)
    author_identity = author_identity(subject, user.nickname)

    cond do
      body == "" ->
        {:error, :empty_body}

      String.length(body) > @max_body_length ->
        {:error, :message_too_long}

      true ->
        case History.find_by_client_id(room_id, author_identity, valid_client_id(client_id)) do
          {:ok, message} ->
            {:ok, message, user}

          :not_found ->
            case Security.allow_message(subject) do
              :ok ->
                with {:ok, updated_user} <- Ranks.public_message_sent(user),
                     {:ok, message} <-
                       broadcast_message(
                         updated_user.nickname,
                         room_id,
                         body,
                         theme_id,
                         appearance,
                         font_id,
                         font_style,
                         recipients,
                         Ranks.for_user(updated_user),
                         client_id,
                         author_identity
                       ) do
                  {:ok, message, updated_user}
                end

              {:error, {:rate_limited, _retry_after_ms}} ->
                {:error, :rate_limited}
            end
        end
    end
  end

  defp build_message(
         author,
         body,
         theme_id,
         appearance,
         font_id,
         font_style,
         recipient_nicknames,
         rank,
         client_id,
         author_identity
       ) do
    Map.merge(
      %{
        id: System.unique_integer([:positive]),
        kind: :text,
        author: author,
        body: body,
        client_id: valid_client_id(client_id),
        author_identity: author_identity,
        recipient: recipient_from_body(body, recipient_nicknames),
        reactions: %{},
        theme_id: theme_id,
        appearance: appearance,
        font_id: font_id,
        font_style: font_style
      }
      |> maybe_put_rank(rank),
      timestamp()
    )
  end

  defp valid_client_id(client_id) when is_binary(client_id) and byte_size(client_id) in 1..64,
    do: client_id

  defp valid_client_id(_client_id), do: nil

  defp author_identity(%Subject{identity_key: identity_key}, _author)
       when is_binary(identity_key),
       do: identity_key

  defp author_identity(%Subject{actor_id: actor_id}, _author) when is_integer(actor_id),
    do: "user:#{actor_id}"

  defp author_identity(%Subject{}, author), do: "author:#{author}"

  defp build_gif_message(author, gif, theme_id, appearance, font_id, font_style, rank) do
    Map.merge(
      %{
        id: System.unique_integer([:positive]),
        kind: :gif,
        author: author,
        body: gif.title,
        media_url: gif.url,
        recipient: nil,
        reactions: %{},
        theme_id: theme_id,
        appearance: appearance,
        font_id: font_id,
        font_style: font_style
      }
      |> maybe_put_rank(rank),
      timestamp()
    )
  end

  defp build_music_message(author, track, theme_id, appearance, font_id, font_style, rank) do
    Map.merge(
      %{
        id: System.unique_integer([:positive]),
        kind: :music,
        author: author,
        body: track.title,
        media_url: track.audio_url,
        media_artist: track.artist,
        media_duration: track.duration,
        media_source_url: track.source_url,
        recipient: nil,
        reactions: %{},
        theme_id: theme_id,
        appearance: appearance,
        font_id: font_id,
        font_style: font_style
      }
      |> maybe_put_rank(rank),
      timestamp()
    )
  end

  defp build_youtube_message(author, video, theme_id, appearance, font_id, font_style, rank) do
    Map.merge(
      %{
        id: System.unique_integer([:positive]),
        kind: :youtube,
        author: author,
        body: video.title,
        media_url: video.id,
        media_duration: format_youtube_duration(video.duration),
        media_source_url: video.source_url,
        recipient: nil,
        reactions: %{},
        theme_id: theme_id,
        appearance: appearance,
        font_id: font_id,
        font_style: font_style
      }
      |> maybe_put_rank(rank),
      timestamp()
    )
  end

  defp normalize_gif(gif) do
    url = Map.get(gif, :url) || Map.get(gif, "url")
    title = Map.get(gif, :title) || Map.get(gif, "title") || "GIF"

    cond do
      not Gifs.valid_media_url?(url) -> {:error, :invalid_gif}
      not is_binary(title) -> {:error, :invalid_gif}
      true -> {:ok, %{url: url, title: String.trim(title) |> String.slice(0, 160)}}
    end
  end

  defp allow_gif_message(subject) do
    case Security.allow_message(subject) do
      :ok -> :ok
      {:error, {:rate_limited, _retry_after_ms}} -> {:error, :rate_limited}
    end
  end

  defp allow_music_message(subject) do
    case Security.allow_message(subject) do
      :ok -> :ok
      {:error, {:rate_limited, _retry_after_ms}} -> {:error, :rate_limited}
    end
  end

  defp allow_youtube_message(subject), do: allow_music_message(subject)

  defp format_youtube_duration(duration) do
    minutes = div(duration, 60)
    seconds = rem(duration, 60)
    "#{minutes}:#{String.pad_leading(to_string(seconds), 2, "0")}"
  end

  defp maybe_put_rank(message, nil), do: message
  defp maybe_put_rank(message, rank), do: Map.put(message, :rank, rank)

  defp recipient_from_body(body, recipient_nicknames) when is_list(recipient_nicknames) do
    recipient_nicknames
    |> Enum.filter(&is_binary/1)
    |> Enum.uniq()
    |> Enum.flat_map(fn nickname ->
      regex = Regex.compile!("(?<![\\p{L}\\p{N}_-])(#{Regex.escape(nickname)}),", "u")

      case Regex.run(regex, body, return: :index) do
        [{index, _length}, _nickname_match] -> [{index, nickname}]
        _no_address -> []
      end
    end)
    |> Enum.min_by(&elem(&1, 0), fn -> nil end)
    |> case do
      {_index, nickname} -> nickname
      nil -> nil
    end
  end

  defp recipient_from_body(_body, _recipient_nicknames), do: nil

  defp timestamp do
    now = DateTime.utc_now()
    %{at: Calendar.strftime(now, "%H:%M:%S"), sent_at: DateTime.to_iso8601(now)}
  end
end
