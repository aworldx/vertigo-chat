# Назначение файла: публичные SEO-страницы с редакционными материалами об общении в сети.
defmodule ChatWeb.ArticlesLive do
  use ChatWeb, :live_view

  @article_title "Зачем нужны чаты, когда есть Telegram и соцсети"
  @article_description "Чем живой общий чат отличается от мессенджеров и соцсетей: преимущества, слабые места и место для настоящего разговора."
  @history_title "От «Кроватки» до Telegram: как менялись чаты в России"

  @history_description "История чатов в Рунете: IRC, «Кроватка», движки Бородина и Августа, ICQ, соцсети и современные мессенджеры."
  @technology_title "Как устроен Vertigo: сообщения, приват и пароли"

  @technology_description "Какие технологии работают в чате Vertigo, где хранится публичная история, почему личные сообщения не сохраняются и как защищаются пароли."

  @impl true
  def mount(_params, _session, socket) do
    {:ok, assign_page(socket, socket.assigns.live_action)}
  end

  defp assign_page(socket, :index) do
    socket
    |> assign(:page_title, "Статьи об общении в интернете")
    |> assign(:og_title, "Статьи Vertigo об общении в интернете")
    |> assign(
      :meta_description,
      "Наблюдения и честные разговоры о чатах, сообществах и том, как мы общаемся в сети."
    )
    |> assign(:canonical_path, ~p"/articles")
  end

  defp assign_page(socket, :show) do
    socket
    |> assign(:page_title, @article_title)
    |> assign(:og_title, @article_title)
    |> assign(:og_type, "article")
    |> assign(:meta_description, @article_description)
    |> assign(:canonical_path, ~p"/articles/chats-vs-messengers")
  end

  defp assign_page(socket, :history) do
    socket
    |> assign(:page_title, @history_title)
    |> assign(:og_title, @history_title)
    |> assign(:og_type, "article")
    |> assign(:meta_description, @history_description)
    |> assign(:canonical_path, ~p"/articles/chat-platforms-russia")
  end

  defp assign_page(socket, :technology) do
    socket
    |> assign(:page_title, @technology_title)
    |> assign(:og_title, @technology_title)
    |> assign(:og_type, "article")
    |> assign(:meta_description, @technology_description)
    |> assign(:canonical_path, ~p"/articles/how-vertigo-chat-works")
  end
end
