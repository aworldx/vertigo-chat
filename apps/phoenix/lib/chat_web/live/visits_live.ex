# Назначение файла: LiveView истории входов и выходов чатлан за последние 48 часов.
defmodule ChatWeb.VisitsLive do
  use ChatWeb, :live_view

  alias Chat.Visits

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Кто был")
     |> assign(:robots, "noindex, nofollow")
     |> assign(:history_hours, Visits.history_hours())
     |> stream(:visits, Visits.list_recent_visits())}
  end

  def format_datetime(nil), do: "Сейчас в чате"

  def format_datetime(datetime) do
    datetime
    |> DateTime.add(3, :hour)
    |> Calendar.strftime("%d.%m.%Y · %H:%M")
  end
end
