defmodule Chat.Visits.Janitor do
  @moduledoc "Closes visits left active by an unexpectedly disconnected chat process."

  use GenServer

  @interval :timer.minutes(1)

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
    Chat.Visits.cleanup_stale_visits()
    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @interval)
  end
end
