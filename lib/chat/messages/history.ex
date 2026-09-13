# Назначение файла: постоянная история публичных и системных сообщений общей комнаты.
defmodule Chat.Messages.History do
  import Ecto.Query

  alias Chat.Appearance
  alias Chat.Messages.StoredMessage
  alias Chat.Repo
  alias Chat.Typography

  @history_limit 30

  def list_recent(room_id) when is_binary(room_id) do
    room_id
    |> recent_query()
    |> Repo.all()
    |> Enum.reverse()
    |> Enum.map(&to_message/1)
  end

  def list_after(room_id, message_id) when is_binary(room_id) and is_integer(message_id) do
    from(message in StoredMessage,
      where: message.room_id == ^room_id and message.id > ^message_id,
      order_by: [asc: message.id]
    )
    |> Repo.all()
    |> Enum.map(&to_message/1)
  end

  def list_after(_room_id, _message_id), do: []

  def list_text_before(room_id, message_id) when is_binary(room_id) and is_integer(message_id) do
    from(message in StoredMessage,
      where: message.room_id == ^room_id and message.id < ^message_id and message.kind == :text,
      order_by: [desc: message.id],
      limit: 12
    )
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
      client_id: Map.get(message, :client_id),
      author_identity: Map.get(message, :author_identity),
      media_url: Map.get(message, :media_url),
      media_artist: Map.get(message, :media_artist),
      media_duration: Map.get(message, :media_duration),
      media_source_url: Map.get(message, :media_source_url),
      recipient: Map.get(message, :recipient),
      theme_id: Map.fetch!(message, :theme_id),
      appearance: Map.fetch!(message, :appearance),
      font_id: Typography.normalize_font_id(Map.get(message, :font_id)),
      font_style: Typography.normalize_font_style(Map.get(message, :font_style)),
      rank: Map.get(message, :rank),
      reactions: encode_reactions(Map.get(message, :reactions, %{})),
      sent_at: sent_at(message)
    }

    case persist(attrs) do
      {:ok, stored_message, :inserted} ->
        trim(room_id)
        {:ok, to_message(stored_message), :inserted}

      {:ok, stored_message, :existing} ->
        {:ok, to_message(stored_message), :existing}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def save(_room_id, _message), do: {:error, :invalid_message}

  def find_by_client_id(room_id, author_identity, client_id)
      when is_binary(room_id) and is_binary(author_identity) and is_binary(client_id) and
             client_id != "" do
    case Repo.get_by(StoredMessage,
           room_id: room_id,
           author_identity: author_identity,
           client_id: client_id
         ) do
      nil -> :not_found
      message -> {:ok, to_message(message)}
    end
  end

  def find_by_client_id(_room_id, _author_identity, _client_id), do: :not_found

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

  defp persist(%{client_id: client_id, author_identity: author_identity} = attrs)
       when is_binary(client_id) and client_id != "" and is_binary(author_identity) do
    changeset = StoredMessage.changeset(%StoredMessage{}, attrs)

    case Repo.insert(changeset,
           on_conflict: :nothing,
           conflict_target: [:room_id, :author_identity, :client_id]
         ) do
      {:ok, %StoredMessage{id: nil}} ->
        {:ok,
         Repo.get_by!(StoredMessage,
           room_id: attrs.room_id,
           author_identity: author_identity,
           client_id: client_id
         ), :existing}

      {:ok, stored_message} ->
        {:ok, stored_message, :inserted}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  defp persist(attrs) do
    case %StoredMessage{} |> StoredMessage.changeset(attrs) |> Repo.insert() do
      {:ok, stored_message} -> {:ok, stored_message, :inserted}
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp to_message(message) do
    %{
      id: message.id,
      kind: message.kind,
      author: message.author,
      body: message.body,
      client_id: message.client_id,
      media_url: message.media_url,
      media_artist: message.media_artist,
      media_duration: message.media_duration,
      media_source_url: message.media_source_url,
      recipient: message.recipient,
      theme_id: message.theme_id,
      appearance: Appearance.normalize(message.appearance),
      font_id: Typography.normalize_font_id(message.font_id),
      font_style: Typography.normalize_font_style(message.font_style),
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
