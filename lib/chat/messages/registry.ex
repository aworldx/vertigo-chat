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

  def toggle_reaction(room_id, message_id, reactor, reactor_key, emoji) do
    GenServer.call(
      __MODULE__,
      {:toggle_reaction, room_id, message_id, reactor, reactor_key, emoji}
    )
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

  def handle_call(
        {:toggle_reaction, room_id, message_id, reactor, reactor_key, emoji},
        _from,
        state
      ) do
    messages = Map.get(state, room_id, [])

    case Enum.find_index(messages, &(to_string(&1.id) == message_id)) do
      nil ->
        {:reply, {:error, :message_unavailable}, state}

      index ->
        message = Enum.at(messages, index)

        if message.author == reactor do
          {:reply, {:error, :own_message}, state}
        else
          message = toggle_message_reaction(message, reactor_key, emoji)
          messages = List.replace_at(messages, index, message)
          {:reply, {:ok, message}, Map.put(state, room_id, messages)}
        end
    end
  end

  defp toggle_message_reaction(message, reactor_key, emoji) do
    reactions = Map.get(message, :reactions, %{})

    selected_emoji =
      Enum.find_value(reactions, fn {selected_emoji, reactors} ->
        if MapSet.member?(reactors, reactor_key), do: selected_emoji
      end)

    reactions = remove_reactor(reactions, reactor_key)

    reactions =
      if selected_emoji == emoji do
        reactions
      else
        Map.update(reactions, emoji, MapSet.new([reactor_key]), &MapSet.put(&1, reactor_key))
      end

    Map.put(message, :reactions, reactions)
  end

  defp remove_reactor(reactions, reactor_key) do
    Enum.reduce(reactions, %{}, fn {emoji, reactors}, acc ->
      reactors = MapSet.delete(reactors, reactor_key)

      if MapSet.size(reactors) == 0,
        do: acc,
        else: Map.put(acc, emoji, reactors)
    end)
  end
end
