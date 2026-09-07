# Назначение файла: публичная посадочная страница для поиска и знакомства с чатом.
defmodule ChatWeb.LandingLive do
  use ChatWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Чат для общения и игр")
     |> assign(:og_title, "Vertigo — чат для общения и игр")
     |> assign(
       :meta_description,
       "Vertigo — русскоязычный чат для общения, новых знакомств и игр с другими чатланами."
     )
     |> assign(:canonical_path, ~p"/about")}
  end
end
