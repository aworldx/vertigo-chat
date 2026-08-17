# Назначение файла: контекст публичных сообщений, их создание, подписка и realtime-публикация.
defmodule Chat.Messages do
  @moduledoc """
  Public chat message context.

  This module owns message creation and realtime publication. Persistence will
  be added here when messages move from the prototype stream into PostgreSQL.
  """

  alias Chat.Appearance
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes

  @default_room_id "lobby"
  @max_body_length 1_000

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

  def list_recent_messages(_room_id \\ @default_room_id) do
    [
      %{
        id: "welcome-1",
        author: "system",
        body:
          "Добро пожаловать в первый Phoenix-чат. Открой эту страницу в двух вкладках и сообщения появятся мгновенно.",
        recipient: nil,
        theme_id: Themes.default_theme_id(),
        appearance: Appearance.default(),
        at: current_time()
      }
    ]
  end

  def room_topic(room_id), do: "room:#{room_id}"

  def max_body_length, do: @max_body_length

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
      author: author,
      body: body,
      recipient: recipient_from_body(body),
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
