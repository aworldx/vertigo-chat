# Назначение файла: хранит в памяти последние публичные сообщения каждой комнаты.
defmodule Chat.Messages.Registry do
  use GenServer

  @moduledoc false

  @history_limit 30

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def append(room_id, message) when is_binary(room_id) and is_map(message) do
    GenServer.call(__MODULE__, {:append, room_id, message})
  end

  def list(room_id) when is_binary(room_id) do
    GenServer.call(__MODULE__, {:list, room_id})
  end

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:append, room_id, message}, _from, state) do
    messages =
      state
      |> Map.get(room_id, [])
      |> Kernel.++([message])
      |> Enum.take(-@history_limit)

    {:reply, :ok, Map.put(state, room_id, messages)}
  end

  def handle_call({:list, room_id}, _from, state) do
    {:reply, Map.get(state, room_id, []), state}
  end
end
