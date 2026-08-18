# Назначение файла: эфемерная адресная доставка личных сообщений без сохранения на сервере.
defmodule Chat.PrivateMessages do
  @moduledoc """
  Delivers private messages only to the sender's and recipient's LiveView processes.

  Messages are never persisted and are not published to the room topic.
  """

  alias Chat.Appearance
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes

  def subscribe(peer_id) when is_binary(peer_id) do
    Phoenix.PubSub.subscribe(Chat.PubSub, peer_topic(peer_id))
  end

  def send_private_message(author, sender_peer, room_id, attrs, %Subject{} = subject)
      when is_binary(author) and is_binary(sender_peer) and is_binary(room_id) and is_map(attrs) do
    with {:ok, recipient, body} <- parse(attrs),
         {:ok, recipient_peer} <- Chatlans.resolve_peer(room_id, recipient),
         :ok <- validate_recipient(sender_peer, recipient_peer),
         :ok <- validate_body(body),
         :ok <- allow_message(subject) do
      message = build_message(author, recipient, sender_peer, recipient_peer, body, attrs)
      deliver(sender_peer, recipient_peer, message)
      {:ok, message}
    end
  end

  def send_private_message(_author, _sender_peer, _room_id, _attrs, %Subject{}),
    do: {:error, :invalid_message}

  def parse(%{"body" => body}) when is_binary(body) do
    body = String.trim(body)

    case Regex.run(
           ~r/^(?:\^([\p{L}\p{N}_-]{3,24}),?\s+|([\p{L}\p{N}_-]{3,24}),\s*)(.+)$/us,
           body,
           capture: :all_but_first
         ) do
      [caret_recipient, "", message] -> {:ok, caret_recipient, String.trim(message)}
      ["", comma_recipient, message] -> {:ok, comma_recipient, String.trim(message)}
      _no_recipient -> {:error, :private_recipient_required}
    end
  end

  def parse(_attrs), do: {:error, :invalid_message}

  def private_syntax?(body) when is_binary(body),
    do: String.starts_with?(String.trim_leading(body), "^")

  def private_syntax?(_body), do: false

  def peer_topic(peer_id), do: "private-peer:#{peer_id}"

  defp validate_recipient(peer_id, peer_id), do: {:error, :self_recipient}
  defp validate_recipient(_sender_peer, _recipient_peer), do: :ok

  defp validate_body(""), do: {:error, :empty_body}

  defp validate_body(body) do
    if String.length(body) <= Messages.max_body_length(),
      do: :ok,
      else: {:error, :message_too_long}
  end

  defp allow_message(subject) do
    case Security.allow_message(subject) do
      :ok -> :ok
      {:error, {:rate_limited, _retry_after_ms}} -> {:error, :rate_limited}
    end
  end

  defp build_message(author, recipient, sender_peer, recipient_peer, body, attrs) do
    %{
      id: "private-#{System.unique_integer([:positive])}",
      kind: :private,
      author: author,
      body: body,
      recipient: recipient,
      sender_peer: sender_peer,
      recipient_peer: recipient_peer,
      theme_id: Themes.normalize_theme_id(Map.get(attrs, "theme_id")),
      appearance: Appearance.normalize(Map.get(attrs, "appearance", Appearance.default())),
      at: Calendar.strftime(Time.utc_now(), "%H:%M:%S")
    }
  end

  defp deliver(sender_peer, recipient_peer, message) do
    event = {:private_message_received, message}
    :ok = Phoenix.PubSub.broadcast(Chat.PubSub, peer_topic(sender_peer), event)
    :ok = Phoenix.PubSub.broadcast(Chat.PubSub, peer_topic(recipient_peer), event)
  end
end
