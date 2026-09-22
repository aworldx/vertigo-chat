# Назначение файла: атомарный in-memory rate limiter для антиспама и регистрации.
defmodule Chat.Security.RateLimiter do
  use GenServer

  @moduledoc false

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def check(key, rules) when is_list(rules) do
    GenServer.call(__MODULE__, {:check, key, rules})
  end

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:check, key, rules}, _from, state) do
    now = System.monotonic_time(:millisecond)

    windows =
      Enum.map(rules, fn {limit, window_ms} ->
        bucket = {key, window_ms}

        timestamps =
          state
          |> Map.get(bucket, [])
          |> Enum.filter(&(&1 > now - window_ms))

        {bucket, limit, window_ms, timestamps}
      end)

    case Enum.find(windows, fn {_bucket, limit, _window_ms, timestamps} ->
           length(timestamps) >= limit
         end) do
      nil ->
        state =
          Enum.reduce(windows, state, fn {bucket, _limit, _window_ms, timestamps}, acc ->
            Map.put(acc, bucket, [now | timestamps])
          end)

        {:reply, :ok, prune(state, now)}

      {_bucket, _limit, window_ms, timestamps} ->
        oldest = Enum.min(timestamps)
        retry_after_ms = max(oldest + window_ms - now, 1)
        {:reply, {:error, {:rate_limited, retry_after_ms}}, prune(state, now)}
    end
  end

  defp prune(state, now) when map_size(state) > 10_000 do
    Map.reject(state, fn {{_key, window_ms}, timestamps} ->
      Enum.all?(timestamps, &(&1 <= now - window_ms))
    end)
  end

  defp prune(state, _now), do: state
end
