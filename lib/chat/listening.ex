# Назначение файла: временное realtime-состояние прослушиваемых чатланами треков.
defmodule Chat.Listening do
  @moduledoc """
  Keeps the currently playing track for chat presences without persisting it.
  """

  use GenServer

  alias Chat.Messages

  @max_track_length 200

  def start_link(_opts), do: GenServer.start_link(__MODULE__, %{}, name: __MODULE__)

  def subscribe(room_id) when is_binary(room_id),
    do: Phoenix.PubSub.subscribe(Chat.PubSub, topic(room_id))

  def track_for(room_id, identity_key)
      when is_binary(room_id) and is_binary(identity_key),
      do: GenServer.call(__MODULE__, {:track_for, room_id, identity_key})

  def track_for(_room_id, _identity_key), do: nil

  def start_listening(room_id, identity_key, track)
      when is_binary(room_id) and is_binary(identity_key) and is_binary(track) do
    case normalize_track(track) do
      nil -> :ok
      track -> GenServer.call(__MODULE__, {:start, room_id, identity_key, track})
    end
  end

  def start_listening(_room_id, _identity_key, _track), do: :ok

  def stop_listening(room_id, identity_key, track)
      when is_binary(room_id) and is_binary(identity_key) and is_binary(track),
      do: GenServer.call(__MODULE__, {:stop, room_id, identity_key, normalize_track(track)})

  def stop_listening(_room_id, _identity_key, _track), do: :ok

  @impl true
  def init(tracks), do: {:ok, tracks}

  @impl true
  def handle_call({:track_for, room_id, identity_key}, _from, tracks) do
    {:reply, get_in(tracks, [room_id, identity_key]), tracks}
  end

  def handle_call({:start, room_id, identity_key, track}, _from, tracks) do
    tracks =
      Map.update(tracks, room_id, %{identity_key => track}, &Map.put(&1, identity_key, track))

    broadcast_changed(room_id)
    {:reply, :ok, tracks}
  end

  def handle_call({:stop, room_id, identity_key, track}, _from, tracks) do
    tracks =
      if is_nil(track) or get_in(tracks, [room_id, identity_key]) == track do
        Map.update(tracks, room_id, %{}, &Map.delete(&1, identity_key))
      else
        tracks
      end

    broadcast_changed(room_id)
    {:reply, :ok, tracks}
  end

  defp normalize_track(track) do
    case String.trim(track) do
      "" -> nil
      value -> String.slice(value, 0, @max_track_length)
    end
  end

  defp broadcast_changed(room_id),
    do: Phoenix.PubSub.broadcast(Chat.PubSub, topic(room_id), :listening_changed)

  defp topic(room_id), do: Messages.room_topic(room_id) <> ":listening"
end
