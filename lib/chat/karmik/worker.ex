# Назначение файла: периодический фоновой обработчик очереди сообщений для Кармика.
defmodule Chat.Karmik.Worker do
  use GenServer

  alias Chat.Karmik
  alias Chat.Karmik.MessageSampler
  alias Chat.Messages

  @room_id "lobby"
  @initial_review_delay_ms 2_000

  def start_link(_opts), do: GenServer.start_link(__MODULE__, :ok, name: __MODULE__)

  @impl true
  def init(:ok) do
    config = Application.get_env(:chat, Chat.Karmik, [])
    enabled? = Keyword.get(config, :enabled?, true)

    if enabled?, do: Messages.subscribe(@room_id)

    queue = if enabled?, do: recent_text_messages(), else: []

    state = %{
      enabled?: enabled?,
      queue: queue,
      queued_ids: MapSet.new(queue, fn message -> message.id end),
      reviewing?: false,
      review_scheduled?: queue != []
    }

    if queue != [], do: Process.send_after(self(), :review_next, @initial_review_delay_ms)

    {:ok, state}
  end

  @impl true
  def handle_info({:message_created, %{kind: :text, id: id} = message}, state) do
    if state.enabled? and not MapSet.member?(state.queued_ids, id) do
      state = %{
        state
        | queue: [message | state.queue],
          queued_ids: MapSet.put(state.queued_ids, id)
      }

      {:noreply, schedule_review(state)}
    else
      {:noreply, state}
    end
  end

  def handle_info(:review_next, %{reviewing?: false} = state) do
    state = %{state | review_scheduled?: false}

    case MessageSampler.select(state.queue) do
      nil ->
        {:noreply, state}

      message ->
        Task.Supervisor.async_nolink(Chat.Karmik.TaskSupervisor, fn -> Karmik.review(message) end)

        state = %{state | queue: [], queued_ids: MapSet.new(), reviewing?: true}

        {:noreply, state}
    end
  end

  def handle_info(:review_next, state), do: {:noreply, %{state | review_scheduled?: false}}

  def handle_info({ref, _result}, state) when is_reference(ref),
    do: {:noreply, review_finished(state)}

  def handle_info({:DOWN, _ref, :process, _pid, _reason}, state),
    do: {:noreply, review_finished(state)}

  def handle_info(_message, state), do: {:noreply, state}

  defp review_finished(state) do
    state = %{state | reviewing?: false}
    schedule_review(state)
  end

  defp schedule_review(%{reviewing?: true} = state), do: state
  defp schedule_review(%{review_scheduled?: true} = state), do: state

  defp schedule_review(state) do
    if state.queue == [], do: state, else: schedule_timer(state)
  end

  defp schedule_timer(state) do
    Process.send_after(self(), :review_next, review_interval_ms())
    %{state | review_scheduled?: true}
  end

  defp review_interval_ms do
    Application.get_env(:chat, Chat.Karmik, []) |> Keyword.get(:review_interval_ms, 180_000)
  end

  defp recent_text_messages do
    @room_id
    |> Messages.list_recent_messages()
    |> Enum.filter(&(Map.get(&1, :kind) == :text))
  end
end
