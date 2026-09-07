# Назначение файла: откладывает сообщения о выходе, чтобы краткий обрыв сети не выглядел как уход из чата.
defmodule Chat.Chatlans.DepartureNotifier do
  @moduledoc false

  use GenServer
  require Logger

  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Visits

  @default_delay :timer.seconds(30)

  def start_link(opts \\ []) do
    case Keyword.get(opts, :name, __MODULE__) do
      nil -> GenServer.start_link(__MODULE__, opts)
      name -> GenServer.start_link(__MODULE__, opts, name: name)
    end
  end

  def schedule(room_id, nickname, identity_key, opts \\ []) do
    announce? = Keyword.get(opts, :announce?, true)
    GenServer.call(server(opts), {:schedule, room_id, nickname, identity_key, announce?})
  end

  def cancel(room_id, identity_key, opts \\ []) do
    GenServer.call(server(opts), {:cancel, room_id, identity_key})
  end

  def announce_now(room_id, nickname, identity_key, opts \\ []) do
    GenServer.call(server(opts), {:announce_now, room_id, nickname, identity_key})
  end

  def pending(room_id, opts \\ []) when is_binary(room_id) do
    GenServer.call(server(opts), {:pending, room_id})
  end

  @impl true
  def init(opts) do
    {:ok,
     %{
       delay: Keyword.get(opts, :delay, @default_delay),
       departures: %{},
       explicit_leaves: %{}
     }}
  end

  @impl true
  def handle_call({:schedule, room_id, nickname, identity_key, announce?}, _from, state) do
    key = {room_id, identity_key}

    if Map.has_key?(explicit_leaves(state), key) do
      Logger.info("session_departure_ignored reason=explicit_leave nickname=#{nickname}")
      {:reply, :ok, state}
    else
      state = cancel_departure(state, key)
      timer = Process.send_after(self(), {:announce_departure, key}, state.delay)

      Logger.info(
        "session_departure_scheduled nickname=#{nickname} grace_ms=#{state.delay} announce=#{announce?}"
      )

      {:reply, :ok,
       put_in(state.departures[key], %{nickname: nickname, timer: timer, announce?: announce?})}
    end
  end

  def handle_call({:cancel, room_id, identity_key}, _from, state) do
    Logger.info("session_departure_cancelled")
    key = {room_id, identity_key}
    {:reply, :ok, state |> cancel_departure(key) |> clear_explicit_leave(key)}
  end

  def handle_call({:announce_now, room_id, nickname, identity_key}, _from, state) do
    key = {room_id, identity_key}

    if Map.has_key?(explicit_leaves(state), key) do
      Logger.info("session_departure_ignored reason=already_left nickname=#{nickname}")
      {:reply, :ok, state}
    else
      state = state |> cancel_departure(key) |> mark_explicit_leave(key)
      Logger.info("session_departure_requested nickname=#{nickname}")
      {:reply, finish_departure(room_id, nickname, identity_key), state}
    end
  end

  def handle_call({:pending, room_id}, _from, state) do
    departures =
      for {{^room_id, identity_key}, departure} <- state.departures do
        %{identity_key: identity_key, nickname: departure.nickname}
      end

    {:reply, departures, state}
  end

  @impl true
  def handle_info({:announce_departure, {room_id, identity_key} = key}, state) do
    {departure, departures} = Map.pop(state.departures, key)

    if departure,
      do: finish_departure(room_id, departure.nickname, identity_key, departure.announce?)

    notify_presence_change(room_id)

    {:noreply, %{state | departures: departures}}
  end

  def handle_info({:forget_explicit_leave, key, marker}, state) do
    state =
      case Map.get(explicit_leaves(state), key) do
        %{marker: ^marker} -> put_explicit_leaves(state, Map.delete(explicit_leaves(state), key))
        _other -> state
      end

    {:noreply, state}
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

  defp mark_explicit_leave(state, key) do
    state = clear_explicit_leave(state, key)
    marker = make_ref()
    timer = Process.send_after(self(), {:forget_explicit_leave, key, marker}, state.delay)

    put_explicit_leaves(
      state,
      Map.put(explicit_leaves(state), key, %{marker: marker, timer: timer})
    )
  end

  defp clear_explicit_leave(state, key) do
    case Map.pop(explicit_leaves(state), key) do
      {nil, explicit_leaves} ->
        put_explicit_leaves(state, explicit_leaves)

      {%{timer: timer}, explicit_leaves} ->
        Process.cancel_timer(timer)
        put_explicit_leaves(state, explicit_leaves)
    end
  end

  defp explicit_leaves(state), do: Map.get(state, :explicit_leaves, %{})

  defp put_explicit_leaves(state, explicit_leaves),
    do: Map.put(state, :explicit_leaves, explicit_leaves)

  defp server(opts), do: Keyword.get(opts, :server, __MODULE__)

  defp finish_departure(room_id, nickname, identity_key, announce? \\ true) do
    if not Chatlans.identity_online?(room_id, identity_key) do
      {:ok, _visit} = Visits.finish_active_visit(identity_key)

      if announce?, do: {:ok, _message} = Messages.announce_presence(nickname, room_id, :left)

      Logger.info("session_departure_finalized nickname=#{nickname} announced=#{announce?}")
      :ok
    else
      Logger.info("session_departure_skipped reason=identity_online")
      :ok
    end
  end

  defp notify_presence_change(room_id) do
    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic(room_id),
      {:presence_grace_changed, room_id}
    )
  end
end
