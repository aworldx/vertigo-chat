# Назначение файла: контекст публичных сообщений, их создание, подписка и realtime-публикация.
defmodule Chat.Messages do
  @moduledoc """
  Public chat message context.

  This module owns message creation, realtime publication and the bounded
  persistent history of public room messages.
  """

  alias Chat.Accounts.User
  alias Chat.Appearance
  alias Chat.Messages.Registry
  alias Chat.Messages.History
  alias Chat.Ranks
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes

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
          Map.get(attrs, "recipient_nicknames", []),
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
      Map.get(attrs, "recipient_nicknames", []),
      Map.get(attrs, "rank"),
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
      Map.get(attrs, "recipient_nicknames", []),
      Map.get(attrs, "rank"),
      subject
    )
  end

  def send_public_message(_author, _room_id, _attrs, %Subject{}),
    do: {:error, :invalid_message}

  def list_recent_messages(room_id \\ @default_room_id) do
    case History.list_recent(room_id) do
      [] ->
        [welcome_message()]

      messages ->
        :ok = Registry.replace(room_id, messages)
        messages
    end
  end

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

  def room_topic(room_id), do: "room:#{room_id}"

  def max_body_length, do: @max_body_length
  def reaction_emojis, do: @reaction_emojis

  defp deliver_message(
         author,
         room_id,
         body,
         theme_id,
         appearance,
         recipient_nicknames,
         rank,
         subject
       ) do
    body = String.trim(body)

    cond do
      body == "" ->
        {:error, :empty_body}

      String.length(body) > @max_body_length ->
        {:error, :message_too_long}

      true ->
        case Security.allow_message(subject) do
          :ok ->
            broadcast_message(
              author,
              room_id,
              body,
              theme_id,
              appearance,
              recipient_nicknames,
              rank
            )

          {:error, {:rate_limited, _retry_after_ms}} ->
            {:error, :rate_limited}
        end
    end
  end

  defp broadcast_message(author, room_id, body, theme_id, appearance, recipient_nicknames, rank) do
    message = build_message(author, body, theme_id, appearance, recipient_nicknames, rank)
    persist_and_broadcast(room_id, message)
  end

  defp persist_and_broadcast(room_id, message) do
    with {:ok, message} <- History.save(room_id, message) do
      :ok = Registry.append(room_id, message)

      :ok =
        Phoenix.PubSub.broadcast(Chat.PubSub, room_topic(room_id), {:message_created, message})

      {:ok, message}
    end
  end

  defp deliver_registered_message(user, room_id, body, theme_id, appearance, recipients, subject) do
    body = String.trim(body)

    cond do
      body == "" ->
        {:error, :empty_body}

      String.length(body) > @max_body_length ->
        {:error, :message_too_long}

      true ->
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
                     recipients,
                     Ranks.for_user(updated_user)
                   ) do
              {:ok, message, updated_user}
            end

          {:error, {:rate_limited, _retry_after_ms}} ->
            {:error, :rate_limited}
        end
    end
  end

  defp build_message(author, body, theme_id, appearance, recipient_nicknames, rank) do
    Map.merge(
      %{
        id: System.unique_integer([:positive]),
        kind: :text,
        author: author,
        body: body,
        recipient: recipient_from_body(body, recipient_nicknames),
        reactions: %{},
        theme_id: theme_id,
        appearance: appearance
      }
      |> maybe_put_rank(rank),
      timestamp()
    )
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
