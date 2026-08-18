# Назначение файла: временный реестр метаданных P2P-картинок и разрешённых пар участников.
defmodule Chat.ImageShares.Registry do
  use GenServer

  @moduledoc false

  @ttl_ms :timer.minutes(15)

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def register(announcement) do
    GenServer.call(__MODULE__, {:register, announcement})
  end

  def request(share_id, room_id, requester_peer) do
    GenServer.call(__MODULE__, {:request, share_id, room_id, requester_peer})
  end

  def authorize(share_id, room_id, from_peer, target_peer) do
    GenServer.call(__MODULE__, {:authorize, share_id, room_id, from_peer, target_peer})
  end

  def authorize_relay_chunk(
        share_id,
        room_id,
        from_peer,
        target_peer,
        index,
        total,
        byte_size,
        chunk_size
      ) do
    GenServer.call(
      __MODULE__,
      {:authorize_relay_chunk, share_id, room_id, from_peer, target_peer, index, total, byte_size,
       chunk_size}
    )
  end

  def close_peer(room_id, peer_id) do
    GenServer.cast(__MODULE__, {:close_peer, room_id, peer_id})
  end

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:register, announcement}, _from, state) do
    state = prune(state)

    if Map.has_key?(state, announcement.share_id) do
      {:reply, {:error, :duplicate_share}, state}
    else
      entry = %{
        announcement: announcement,
        requesters: MapSet.new(),
        relay_chunks: %{},
        expires_at: now_ms() + @ttl_ms
      }

      {:reply, :ok, Map.put(state, announcement.share_id, entry)}
    end
  end

  def handle_call({:request, share_id, room_id, requester_peer}, _from, state) do
    state = prune(state)

    case Map.get(state, share_id) do
      %{announcement: %{room_id: ^room_id} = announcement} = entry ->
        entry = %{entry | requesters: MapSet.put(entry.requesters, requester_peer)}
        {:reply, {:ok, announcement}, Map.put(state, share_id, entry)}

      _missing_or_other_room ->
        {:reply, {:error, :share_unavailable}, state}
    end
  end

  def handle_call({:authorize, share_id, room_id, from_peer, target_peer}, _from, state) do
    state = prune(state)

    authorized? =
      case Map.get(state, share_id) do
        %{
          announcement: %{room_id: ^room_id, sender_peer: sender_peer},
          requesters: requesters
        } ->
          (from_peer == sender_peer && MapSet.member?(requesters, target_peer)) ||
            (target_peer == sender_peer && MapSet.member?(requesters, from_peer))

        _missing_or_other_room ->
          false
      end

    {:reply, if(authorized?, do: :ok, else: {:error, :signal_not_allowed}), state}
  end

  def handle_call(
        {:authorize_relay_chunk, share_id, room_id, from_peer, target_peer, index, total,
         byte_size, chunk_size},
        _from,
        state
      ) do
    state = prune(state)

    case Map.get(state, share_id) do
      %{
        announcement: %{
          room_id: ^room_id,
          sender_peer: ^from_peer,
          size: image_size
        },
        requesters: requesters
      } = entry ->
        received_indices = Map.get(entry.relay_chunks, target_peer, MapSet.new())
        expected_total = div(image_size + chunk_size - 1, chunk_size)
        expected_size = min(chunk_size, image_size - index * chunk_size)

        valid? =
          MapSet.member?(requesters, target_peer) && total == expected_total && index >= 0 &&
            index < total && byte_size == expected_size &&
            not MapSet.member?(received_indices, index)

        if valid? do
          relay_chunks =
            Map.put(entry.relay_chunks, target_peer, MapSet.put(received_indices, index))

          {:reply, :ok, Map.put(state, share_id, %{entry | relay_chunks: relay_chunks})}
        else
          {:reply, {:error, :invalid_relay_chunk}, state}
        end

      _missing_or_unauthorized ->
        {:reply, {:error, :signal_not_allowed}, state}
    end
  end

  @impl true
  def handle_cast({:close_peer, room_id, peer_id}, state) do
    state =
      state
      |> prune()
      |> Enum.reduce(%{}, fn {share_id, entry}, acc ->
        announcement = entry.announcement

        if announcement.room_id == room_id && announcement.sender_peer == peer_id do
          acc
        else
          Map.put(acc, share_id, %{
            entry
            | requesters: MapSet.delete(entry.requesters, peer_id),
              relay_chunks: Map.delete(entry.relay_chunks, peer_id)
          })
        end
      end)

    {:noreply, state}
  end

  defp prune(state) do
    now = now_ms()
    Map.reject(state, fn {_share_id, entry} -> entry.expires_at <= now end)
  end

  defp now_ms, do: System.monotonic_time(:millisecond)
end
