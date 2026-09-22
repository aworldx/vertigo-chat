# Назначение файла: завершает reconnecting-сессии, чей серверный grace-period истёк.
defmodule Chat.Sessions.Reaper do
  use GenServer

  @interval :timer.seconds(15)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @impl true
  def init(opts) do
    if Keyword.get(opts, :enabled?, true) do
      interval = Keyword.get(opts, :interval, @interval)
      Process.send_after(self(), :reap, interval)
      {:ok, %{interval: interval}}
    else
      :ignore
    end
  end

  @impl true
  def handle_info(:reap, %{interval: interval} = state) do
    :ok = Chat.Sessions.reap()

    Process.send_after(self(), :reap, interval)
    {:noreply, state}
  end
end
