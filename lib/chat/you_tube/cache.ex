# Назначение файла: общий временный MP4-кэш YouTube с дедупликацией подготовки роликов.
defmodule Chat.YouTube.Cache do
  @moduledoc false

  use GenServer

  require Logger

  @default_ttl_ms :timer.hours(6)
  @default_max_bytes 2 * 1_024 * 1_024 * 1_024
  @default_max_preparations 2
  @cleanup_interval_ms :timer.minutes(10)

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  def fetch(video_id), do: GenServer.call(__MODULE__, {:fetch, video_id}, :timer.minutes(3))
  def stats, do: GenServer.call(__MODULE__, :stats)

  @impl true
  def init(_opts) do
    config = Application.get_env(:chat, Chat.YouTube, []) || []

    directory =
      Keyword.get(config, :cache_dir, Path.join(System.tmp_dir!(), "chat-youtube-cache"))

    File.mkdir_p!(directory)
    Process.send_after(self(), :cleanup, @cleanup_interval_ms)

    {:ok,
     %{
       directory: directory,
       entries: %{},
       preparing: %{},
       queued: [],
       bytes: 0,
       ttl_ms: Keyword.get(config, :cache_ttl_ms, @default_ttl_ms),
       max_bytes: Keyword.get(config, :cache_max_bytes, @default_max_bytes),
       max_preparations: Keyword.get(config, :cache_max_preparations, @default_max_preparations),
       hits: 0,
       misses: 0,
       failures: 0
     }}
  end

  @impl true
  def handle_call({:fetch, id}, from, state) do
    case Map.get(state.entries, id) do
      %{path: path} = entry when is_binary(path) ->
        case File.stat(path) do
          {:ok, %{size: size}} ->
            entry = %{entry | size: size, accessed_at: now_ms()}

            {:reply, {:ok, Map.take(entry, [:path, :size])},
             %{state | entries: Map.put(state.entries, id, entry), hits: state.hits + 1}}

          _missing ->
            start_or_queue(id, from, remove_entry(state, id))
        end

      nil ->
        start_or_queue(id, from, %{state | misses: state.misses + 1})
    end
  end

  @impl true
  def handle_call(:stats, _from, state) do
    {:reply,
     %{
       active_preparations: map_size(state.preparing),
       queued_preparations: length(state.queued),
       entries: map_size(state.entries),
       bytes: state.bytes,
       hits: state.hits,
       misses: state.misses,
       failures: state.failures
     }, state}
  end

  @impl true
  def handle_info({:prepared, id, result, started_at}, state) do
    %{waiters: waiters, path: path} = Map.fetch!(state.preparing, id)
    state = %{state | preparing: Map.delete(state.preparing, id)}

    case result do
      {:ok, size} ->
        entry = %{path: path, size: size, accessed_at: now_ms()}

        Logger.info(
          "youtube_cache_prepared video_id=#{id} bytes=#{size} duration_ms=#{now_ms() - started_at}"
        )

        Enum.each(waiters, &GenServer.reply(&1, {:ok, Map.take(entry, [:path, :size])}))

        state
        |> Map.put(:entries, Map.put(state.entries, id, entry))
        |> Map.update!(:bytes, &(&1 + size))
        |> trim_cache()
        |> start_queued()

      {:error, reason} ->
        File.rm(path)

        Logger.warning(
          "youtube_cache_prepare_failed video_id=#{id} reason=#{inspect(reason)} duration_ms=#{now_ms() - started_at}"
        )

        Enum.each(waiters, &GenServer.reply(&1, {:error, :stream_unavailable}))
        state |> Map.update!(:failures, &(&1 + 1)) |> start_queued()
    end
    |> then(&{:noreply, &1})
  end

  def handle_info(:cleanup, state) do
    Process.send_after(self(), :cleanup, @cleanup_interval_ms)
    {:noreply, state |> remove_expired() |> trim_cache()}
  end

  defp start_or_queue(id, from, state) do
    case Map.get(state.preparing, id) do
      %{waiters: waiters} = preparation ->
        {:noreply,
         %{
           state
           | preparing: Map.put(state.preparing, id, %{preparation | waiters: [from | waiters]})
         }}

      nil when map_size(state.preparing) < state.max_preparations ->
        {:noreply, start_preparation(state, id, [from])}

      nil ->
        {:noreply, %{state | queued: state.queued ++ [{id, from}]}}
    end
  end

  defp start_preparation(state, id, waiters) do
    path = Path.join(state.directory, "#{id}.mp4")
    started_at = now_ms()
    server = self()
    Task.start(fn -> send(server, {:prepared, id, prepare(id, path), started_at}) end)
    preparation = %{path: path, waiters: waiters}
    %{state | preparing: Map.put(state.preparing, id, preparation)}
  end

  defp start_queued(state) do
    if map_size(state.preparing) < state.max_preparations and state.queued != [] do
      {id, from} = hd(state.queued)
      remaining = tl(state.queued)

      case Map.get(state.preparing, id) do
        nil ->
          start_preparation(%{state | queued: remaining}, id, [from])

        preparation ->
          start_queued(%{
            state
            | queued: remaining,
              preparing:
                Map.put(state.preparing, id, %{
                  preparation
                  | waiters: [from | preparation.waiters]
                })
          })
      end
    else
      state
    end
  end

  defp prepare(id, path) do
    case Chat.YouTube.download_to_file(id, path) do
      :ok ->
        case File.stat(path) do
          {:ok, %{size: size}} when size > 0 -> {:ok, size}
          _invalid -> {:error, :empty_file}
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp remove_expired(state) do
    cutoff = now_ms() - state.ttl_ms

    Enum.reduce(state.entries, state, fn {id, %{accessed_at: accessed_at}}, state ->
      if accessed_at < cutoff, do: remove_entry(state, id), else: state
    end)
  end

  defp trim_cache(state) when state.bytes <= state.max_bytes, do: state

  defp trim_cache(state) do
    case Enum.min_by(state.entries, fn {_id, entry} -> entry.accessed_at end, fn -> nil end) do
      {id, _entry} -> state |> remove_entry(id) |> trim_cache()
      nil -> state
    end
  end

  defp remove_entry(state, id) do
    case Map.pop(state.entries, id) do
      {nil, _entries} ->
        state

      {%{path: path, size: size}, entries} ->
        File.rm(path)
        %{state | entries: entries, bytes: max(0, state.bytes - size)}
    end
  end

  defp now_ms, do: System.monotonic_time(:millisecond)
end
