# Назначение файла: постоянная история публичных и системных сообщений общей комнаты.
defmodule Chat.Messages.History do
  import Ecto.Query

  alias Chat.Appearance
  alias Chat.Messages.StoredMessage
  alias Chat.Repo

  @history_limit 30

  def list_recent(room_id) when is_binary(room_id) do
    room_id
    |> recent_query()
    |> Repo.all()
    |> Enum.reverse()
    |> Enum.map(&to_message/1)
  end

  def save(room_id, message) when is_binary(room_id) and is_map(message) do
    attrs = %{
      room_id: room_id,
      kind: Map.fetch!(message, :kind),
      author: Map.fetch!(message, :author),
      body: Map.fetch!(message, :body),
      recipient: Map.get(message, :recipient),
      theme_id: Map.fetch!(message, :theme_id),
      appearance: Map.fetch!(message, :appearance),
      rank: Map.get(message, :rank),
      reactions: encode_reactions(Map.get(message, :reactions, %{})),
      sent_at: sent_at(message)
    }

    with {:ok, stored_message} <-
           %StoredMessage{} |> StoredMessage.changeset(attrs) |> Repo.insert() do
      trim(room_id)
      {:ok, to_message(stored_message)}
    end
  end

  def save(_room_id, _message), do: {:error, :invalid_message}

  def update_reactions(room_id, message_id, reactions)
      when is_binary(room_id) and is_integer(message_id) and is_map(reactions) do
    from(message in StoredMessage,
      where: message.room_id == ^room_id and message.id == ^message_id
    )
    |> Repo.update_all(
      set: [reactions: encode_reactions(reactions), updated_at: DateTime.utc_now()]
    )

    :ok
  end

  def update_reactions(_room_id, _message_id, _reactions), do: :ok

  defp recent_query(room_id) do
    from(message in StoredMessage,
      where: message.room_id == ^room_id,
      order_by: [desc: message.sent_at, desc: message.id],
      limit: @history_limit
    )
  end

  defp trim(room_id) do
    keep_ids = from(message in recent_query(room_id), select: message.id)

    from(message in StoredMessage,
      where: message.room_id == ^room_id and message.id not in subquery(keep_ids)
    )
    |> Repo.delete_all()

    :ok
  end

  defp to_message(message) do
    %{
      id: message.id,
      kind: message.kind,
      author: message.author,
      body: message.body,
      recipient: message.recipient,
      theme_id: message.theme_id,
      appearance: Appearance.normalize(message.appearance),
      reactions: decode_reactions(message.reactions),
      sent_at: DateTime.to_iso8601(message.sent_at),
      at: Calendar.strftime(message.sent_at, "%H:%M:%S")
    }
    |> maybe_put_rank(decode_rank(message.rank))
  end

  defp sent_at(%{sent_at: sent_at}) when is_binary(sent_at) do
    {:ok, sent_at, _offset} = DateTime.from_iso8601(sent_at)
    sent_at
  end

  defp sent_at(%{sent_at: %DateTime{} = sent_at}), do: sent_at

  defp encode_reactions(reactions) do
    Map.new(reactions, fn {emoji, reactors} -> {emoji, MapSet.to_list(reactors)} end)
  end

  defp decode_reactions(reactions) do
    Map.new(reactions || %{}, fn {emoji, reactors} -> {emoji, MapSet.new(reactors)} end)
  end

  defp decode_rank(nil), do: nil

  defp decode_rank(rank) when is_map(rank) do
    %{
      title: Map.get(rank, "title") || Map.get(rank, :title),
      icon: Map.get(rank, "icon") || Map.get(rank, :icon),
      messages: Map.get(rank, "messages") || Map.get(rank, :messages),
      hours: Map.get(rank, "hours") || Map.get(rank, :hours)
    }
  end

  defp decode_rank(_rank), do: nil

  defp maybe_put_rank(message, nil), do: message
  defp maybe_put_rank(message, rank), do: Map.put(message, :rank, rank)
end
