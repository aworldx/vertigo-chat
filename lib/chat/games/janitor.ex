# Назначение файла: периодически удаляет заброшенные игровые доски.
defmodule Chat.Games.Janitor do
  use GenServer

  @interval :timer.hours(1)

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_cleanup()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    Chat.Games.cleanup_stale_games()
    Chat.Checkers.cleanup_stale_games()
    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @interval)
  end
end
