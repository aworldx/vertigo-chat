# Назначение файла: компактные агрегаты наблюдаемости без содержимого чата и персональных данных.
defmodule Chat.Metrics do
  @moduledoc """
  Keeps bounded, process-local counters for Prometheus scrapes.

  Prometheus is responsible for retaining history. This process deliberately
  stores neither request bodies, addresses, session identifiers nor user data.
  """

  use GenServer

  @handler_id "chat-metrics-http"
  @latency_buckets [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000]

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  def increment(metric, labels \\ %{}) when is_atom(metric) and is_map(labels) do
    GenServer.cast(__MODULE__, {:increment, metric, labels})
  end

  def snapshot, do: GenServer.call(__MODULE__, :snapshot)

  @impl true
  def init(_opts) do
    :ok =
      :telemetry.attach(
        @handler_id,
        [:phoenix, :router_dispatch, :stop],
        &__MODULE__.handle_http_stop/4,
        self()
      )

    {:ok, %{counters: %{}, requests: %{}}}
  end

  @impl true
  def terminate(_reason, _state), do: :telemetry.detach(@handler_id)

  # Telemetry handlers must stay cheap: send the aggregate update to this
  # process rather than doing formatting or database work on a request process.
  def handle_http_stop(_event, measurements, metadata, pid) do
    duration_ms = System.convert_time_unit(measurements.duration, :native, :millisecond)
    route = metadata[:route] || "unmatched"
    status = metadata[:conn].status || 200
    send(pid, {:http_stop, route, status, duration_ms})
  end

  @impl true
  def handle_info({:http_stop, "/internal/metrics", _status, _duration_ms}, state),
    do: {:noreply, state}

  def handle_info({:http_stop, route, status, duration_ms}, state) do
    key = {route, status}
    request = Map.get(state.requests, key, new_request())

    request = %{
      request
      | count: request.count + 1,
        errors_4xx: request.errors_4xx + if(status in 400..499, do: 1, else: 0),
        errors_5xx: request.errors_5xx + if(status in 500..599, do: 1, else: 0),
        duration_sum_ms: request.duration_sum_ms + duration_ms,
        buckets: increment_bucket(request.buckets, duration_ms)
    }

    {:noreply, put_in(state.requests[key], request)}
  end

  @impl true
  def handle_cast({:increment, metric, labels}, state) do
    key = {metric, labels}
    {:noreply, update_in(state.counters[key], fn value -> (value || 0) + 1 end)}
  end

  @impl true
  def handle_call(:snapshot, _from, state) do
    vm = %{
      memory_bytes: :erlang.memory(:total),
      run_queue: :erlang.statistics(:run_queue)
    }

    sessions = Chat.Sessions.Store.count_by_status()
    {:reply, Map.merge(state, %{vm: vm, sessions: sessions}), state}
  end

  def latency_buckets, do: @latency_buckets

  defp new_request do
    %{count: 0, errors_4xx: 0, errors_5xx: 0, duration_sum_ms: 0, buckets: %{}}
  end

  defp increment_bucket(buckets, duration_ms) do
    Enum.reduce(@latency_buckets, buckets, fn bucket, acc ->
      if duration_ms <= bucket, do: Map.update(acc, bucket, 1, &(&1 + 1)), else: acc
    end)
  end
end
