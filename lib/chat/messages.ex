# Назначение файла: контекст публичных сообщений, их создание, подписка и realtime-публикация.
defmodule Chat.Messages do
  @moduledoc """
  Public chat message context.

  This module owns message creation, realtime publication and the bounded
  in-memory history of public room messages. Messages are not persisted.
  """

  alias Chat.Appearance
  alias Chat.Messages.Registry
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

  def send_public_message(author, room_id, attrs, subject)

  def send_public_message(
        author,
        room_id,
        %{
          "body" => body,
          "theme_id" => theme_id,
          "appearance" => appearance
        },
        %Subject{} = subject
      )
      when is_binary(body) do
    deliver_message(
      author,
      room_id,
      body,
      Themes.normalize_theme_id(theme_id),
      Appearance.normalize(appearance),
      subject
    )
  end

  def send_public_message(author, room_id, %{"body" => body}, %Subject{} = subject)
      when is_binary(body) do
    deliver_message(
      author,
      room_id,
      body,
      Themes.default_theme_id(),
      Appearance.default(),
      subject
    )
  end

  def send_public_message(_author, _room_id, _attrs, %Subject{}),
    do: {:error, :invalid_message}

  def list_recent_messages(room_id \\ @default_room_id) do
    case Registry.list(room_id) do
      [] -> [welcome_message()]
      messages -> messages
    end
  end

  def toggle_reaction(reactor, reactor_key, room_id, message_id, emoji)
      when is_binary(reactor) and is_binary(reactor_key) and is_binary(room_id) and
             is_binary(message_id) and emoji in @reaction_emojis do
    case Registry.toggle_reaction(room_id, message_id, reactor, reactor_key, emoji) do
      {:ok, message} ->
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
    %{
      id: "welcome-1",
      kind: :text,
      author: "system",
      body: "Добро пожаловать в чат!",
      recipient: nil,
      theme_id: Themes.default_theme_id(),
      appearance: Appearance.default(),
      at: current_time()
    }
  end

  def room_topic(room_id), do: "room:#{room_id}"

  def max_body_length, do: @max_body_length
  def reaction_emojis, do: @reaction_emojis

  defp deliver_message(author, room_id, body, theme_id, appearance, subject) do
    body = String.trim(body)

    cond do
      body == "" ->
        {:error, :empty_body}

      String.length(body) > @max_body_length ->
        {:error, :message_too_long}

      true ->
        case Security.allow_message(subject) do
          :ok -> broadcast_message(author, room_id, body, theme_id, appearance)
          {:error, {:rate_limited, _retry_after_ms}} -> {:error, :rate_limited}
        end
    end
  end

  defp broadcast_message(author, room_id, body, theme_id, appearance) do
    message = build_message(author, body, theme_id, appearance)
    :ok = Registry.append(room_id, message)

    :ok =
      Phoenix.PubSub.broadcast(
        Chat.PubSub,
        room_topic(room_id),
        {:message_created, message}
      )

    {:ok, message}
  end

  defp build_message(author, body, theme_id, appearance) do
    %{
      id: System.unique_integer([:positive]),
      kind: :text,
      author: author,
      body: body,
      recipient: recipient_from_body(body),
      reactions: %{},
      theme_id: theme_id,
      appearance: appearance,
      at: current_time()
    }
  end

  defp recipient_from_body(body) do
    case Regex.run(~r/^([\p{L}\p{N}_-]{3,24}),(?:\s|$)/u, body, capture: :all_but_first) do
      [nickname] -> nickname
      _no_recipient -> nil
    end
  end

  defp current_time do
    Calendar.strftime(Time.utc_now(), "%H:%M:%S")
  end
end
