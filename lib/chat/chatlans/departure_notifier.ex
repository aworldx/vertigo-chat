# Назначение файла: откладывает сообщения о выходе, чтобы краткий обрыв сети не выглядел как уход из чата.
defmodule Chat.Chatlans.DepartureNotifier do
  @moduledoc false

  use GenServer

  alias Chat.Chatlans
  alias Chat.Messages

  @default_delay :timer.seconds(30)

  def start_link(opts \\ []) do
    case Keyword.get(opts, :name, __MODULE__) do
      nil -> GenServer.start_link(__MODULE__, opts)
      name -> GenServer.start_link(__MODULE__, opts, name: name)
    end
  end

  def schedule(room_id, nickname, session_id, opts \\ []) do
    GenServer.call(server(opts), {:schedule, room_id, nickname, session_id})
  end

  def cancel(room_id, session_id, opts \\ []) do
    GenServer.call(server(opts), {:cancel, room_id, session_id})
  end

  def announce_now(room_id, nickname, session_id, opts \\ []) do
    GenServer.call(server(opts), {:announce_now, room_id, nickname, session_id})
  end

  @impl true
  def init(opts) do
    {:ok, %{delay: Keyword.get(opts, :delay, @default_delay), departures: %{}}}
  end

  @impl true
  def handle_call({:schedule, room_id, nickname, session_id}, _from, state) do
    key = {room_id, session_id}
    state = cancel_departure(state, key)
    timer = Process.send_after(self(), {:announce_departure, key}, state.delay)

    {:reply, :ok, put_in(state.departures[key], %{nickname: nickname, timer: timer})}
  end

  def handle_call({:cancel, room_id, session_id}, _from, state) do
    {:reply, :ok, cancel_departure(state, {room_id, session_id})}
  end

  def handle_call({:announce_now, room_id, nickname, session_id}, _from, state) do
    state = cancel_departure(state, {room_id, session_id})
    {:reply, Messages.announce_presence(nickname, room_id, :left), state}
  end

  @impl true
  def handle_info({:announce_departure, {room_id, session_id} = key}, state) do
    {departure, departures} = Map.pop(state.departures, key)

    if departure && not Chatlans.session_online?(room_id, session_id) do
      Messages.announce_presence(departure.nickname, room_id, :left)
    end

    {:noreply, %{state | departures: departures}}
  end

  defp cancel_departure(state, key) do
    case Map.pop(state.departures, key) do
      {nil, departures} ->
        %{state | departures: departures}

      {%{timer: timer}, departures} ->
        Process.cancel_timer(timer)
        %{state | departures: departures}
    end
  end

  defp server(opts), do: Keyword.get(opts, :server, __MODULE__)
end
