# Назначение файла: пул авторизованных HTTP-прокси для фонового поиска музыки.
defmodule Chat.Music.ProxyPool do
  @moduledoc false

  use GenServer

  @reload_interval :timer.minutes(5)
  @base_cooldown_ms 5_000
  @max_cooldown_ms :timer.minutes(5)

  @type proxy :: %{
          id: binary(),
          host: binary(),
          port: pos_integer(),
          authorization: binary()
        }

  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @spec candidates(pos_integer()) :: [proxy()]
  def candidates(limit \\ 3) when is_integer(limit) and limit > 0 do
    GenServer.call(__MODULE__, {:candidates, limit})
  end

  @spec report_success(binary()) :: :ok
  def report_success(id) when is_binary(id), do: GenServer.cast(__MODULE__, {:success, id})

  @spec report_failure(binary()) :: :ok
  def report_failure(id) when is_binary(id), do: GenServer.cast(__MODULE__, {:failure, id})

  @spec reload() :: :ok
  def reload, do: GenServer.call(__MODULE__, :reload)

  @impl true
  def init(_opts) do
    state = load_proxies(%{proxies: %{}})
    schedule_reload()
    {:ok, state}
  end

  @impl true
  def handle_call({:candidates, limit}, _from, state) do
    now = System.monotonic_time(:millisecond)

    {available, unavailable} =
      state.proxies
      |> Map.values()
      |> Enum.split_with(&(&1.cooldown_until <= now))

    selected =
      if(available == [], do: unavailable, else: available)
      |> Enum.sort_by(&{&1.failures, &1.last_used_at})
      |> Enum.take(limit)

    proxies =
      Enum.reduce(selected, state.proxies, fn proxy, proxies ->
        Map.update!(proxies, proxy.proxy.id, &Map.put(&1, :last_used_at, now))
      end)

    {:reply, Enum.map(selected, &public_proxy/1), %{state | proxies: proxies}}
  end

  def handle_call(:reload, _from, state), do: {:reply, :ok, load_proxies(state)}

  @impl true
  def handle_cast({:success, id}, state) do
    {:noreply,
     update_proxy(state, id, fn proxy ->
       %{
         proxy
         | failures: 0,
           cooldown_until: 0,
           last_success_at: System.monotonic_time(:millisecond)
       }
     end)}
  end

  def handle_cast({:failure, id}, state) do
    now = System.monotonic_time(:millisecond)

    {:noreply,
     update_proxy(state, id, fn proxy ->
       failures = proxy.failures + 1

       cooldown =
         min(@base_cooldown_ms * trunc(:math.pow(2, min(failures - 1, 5))), @max_cooldown_ms)

       %{proxy | failures: failures, cooldown_until: now + cooldown}
     end)}
  end

  @impl true
  def handle_info(:reload, state) do
    schedule_reload()
    {:noreply, load_proxies(state)}
  end

  defp update_proxy(state, id, fun) do
    if Map.has_key?(state.proxies, id) do
      %{state | proxies: Map.update!(state.proxies, id, fun)}
    else
      state
    end
  end

  defp load_proxies(state) do
    proxies =
      proxy_file()
      |> read_proxy_file()
      |> Enum.map(&to_proxy/1)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq_by(& &1.id)
      |> Map.new(fn proxy ->
        previous = Map.get(state.proxies, proxy.id, %{})

        {proxy.id,
         Map.merge(
           %{
             proxy: proxy,
             failures: 0,
             cooldown_until: 0,
             last_used_at: 0,
             last_success_at: 0
           },
           Map.take(previous, [:failures, :cooldown_until, :last_used_at, :last_success_at])
         )}
      end)

    %{state | proxies: proxies}
  end

  defp proxy_file do
    Application.get_env(:chat, Chat.Music, [])[:proxy_file]
  end

  defp read_proxy_file(path) when is_binary(path) do
    case File.read(path) do
      {:ok, contents} -> String.split(contents, ~r/\R/, trim: true)
      {:error, _reason} -> []
    end
  end

  defp read_proxy_file(_path), do: []

  defp to_proxy(line) do
    case String.split(line, ":", parts: 4) do
      [host, port, username, password] ->
        with true <- valid_host?(host),
             {port, ""} when port in 1..65_535 <- Integer.parse(port),
             true <- username != "" and password != "" do
          id = :crypto.hash(:sha256, line) |> Base.url_encode64(padding: false)

          %{
            id: id,
            host: host,
            port: port,
            authorization: "Basic " <> Base.encode64("#{username}:#{password}")
          }
        else
          _invalid -> nil
        end

      _invalid ->
        nil
    end
  end

  defp valid_host?(host), do: Regex.match?(~r/\A[a-zA-Z0-9.-]+\z/, host)

  defp public_proxy(%{proxy: proxy}), do: proxy

  defp schedule_reload, do: Process.send_after(self(), :reload, @reload_interval)
end
