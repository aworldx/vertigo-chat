# Назначение файла: LiveView-страница с условиями киношных званий чатлан.
defmodule ChatWeb.RanksLive do
  use ChatWeb, :live_view

  alias Chat.Ranks

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Помощь")
     |> assign(
       :meta_description,
       "Помощь по чату Vertigo: правила, возможности и ранги чатланов."
     )
     |> assign(:canonical_path, ~p"/help")
     |> assign(:ranks, Ranks.rank_definitions())}
  end

  def format_number(number) when is_integer(number) do
    number
    |> Integer.to_string()
    |> String.reverse()
    |> String.graphemes()
    |> Enum.chunk_every(3)
    |> Enum.map_join(" ", &Enum.join/1)
    |> String.reverse()
  end

  def feature_unlock(rank), do: Ranks.feature_unlock(rank)
end
