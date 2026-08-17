# Назначение файла: контекст публичных сообщений, их создание, подписка и realtime-публикация.
defmodule Chat.Messages do
  @moduledoc """
  Public chat message context.

  This module owns message creation and realtime publication. Persistence will
  be added here when messages move from the prototype stream into PostgreSQL.
  """

  alias Chat.Appearance
  alias Chat.Themes

  @default_room_id "lobby"

  def subscribe(room_id \\ @default_room_id) do
    Phoenix.PubSub.subscribe(Chat.PubSub, room_topic(room_id))
  end

  def send_public_message(author, room_id \\ @default_room_id, attrs)

  def send_public_message(author, room_id, %{
        "body" => body,
        "theme_id" => theme_id,
        "appearance" => appearance
      })
      when is_binary(body) do
    body = String.trim(body)

    if body == "" do
      {:error, :empty_body}
    else
      message =
        build_message(
          author,
          body,
          Themes.normalize_theme_id(theme_id),
          Appearance.normalize(appearance)
        )

      :ok =
        Phoenix.PubSub.broadcast(
          Chat.PubSub,
          room_topic(room_id),
          {:message_created, message}
        )

      {:ok, message}
    end
  end

  def send_public_message(author, room_id, %{"body" => body}) when is_binary(body) do
    body = String.trim(body)

    if body == "" do
      {:error, :empty_body}
    else
      message =
        build_message(
          author,
          body,
          Themes.default_theme_id(),
          Appearance.default()
        )

      :ok =
        Phoenix.PubSub.broadcast(
          Chat.PubSub,
          room_topic(room_id),
          {:message_created, message}
        )

      {:ok, message}
    end
  end

  def send_public_message(_author, _room_id, _attrs), do: {:error, :invalid_message}

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
