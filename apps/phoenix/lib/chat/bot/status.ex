# Назначение файла: общий статус Хичкока при временных и суточных лимитах.
defmodule Chat.Bot.Status do
  use GenServer

  alias Chat.Bot.Usage
  alias Chat.Messages

  @room_id "lobby"
  @default_busy_ms 60_000

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{busy_until: nil, timer: nil}, name: __MODULE__)
  end

  def available? do
    case Process.whereis(__MODULE__) do
      nil -> true
      _pid -> GenServer.call(__MODULE__, :available?)
    end
  end

  def mark_busy(retry_after_ms \\ @default_busy_ms) when is_integer(retry_after_ms) do
    GenServer.call(__MODULE__, {:mark_busy, max(retry_after_ms, 1_000)})
  end

  def mark_daily_limit do
    GenServer.call(__MODULE__, {:mark_busy, Usage.milliseconds_until_reset()})
  end

  @doc false
  def reset do
    GenServer.call(__MODULE__, :reset)
  end

  @impl true
  def init(state) do
    if Usage.available?() do
      {:ok, state}
    else
      {:ok, schedule_busy(state, Usage.milliseconds_until_reset())}
    end
  end

  @impl true
  def handle_call(:available?, _from, state) do
    {:reply, is_nil(state.busy_until) or monotonic_ms() >= state.busy_until, state}
  end

  def handle_call({:mark_busy, retry_after_ms}, _from, state) do
    broadcast_status(:busy)
    {:reply, :ok, schedule_busy(state, retry_after_ms)}
  end

  def handle_call(:reset, _from, state) do
    if state.timer, do: Process.cancel_timer(state.timer)
    broadcast_status(:available)
    {:reply, :ok, %{state | busy_until: nil, timer: nil}}
  end

  @impl true
  def handle_info(:available_again, state) do
    if Usage.available?() do
      broadcast_status(:available)
      {:noreply, %{state | busy_until: nil, timer: nil}}
    else
      {:noreply, schedule_busy(state, Usage.milliseconds_until_reset())}
    end
  end

  defp schedule_busy(state, busy_ms) do
    if state.timer, do: Process.cancel_timer(state.timer)

    %{
      state
      | busy_until: monotonic_ms() + busy_ms,
        timer: Process.send_after(self(), :available_again, busy_ms)
    }
  end

  defp broadcast_status(status) do
    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic(@room_id),
      {:bot_status_changed, status}
    )
  end

  defp monotonic_ms, do: System.monotonic_time(:millisecond)
end
