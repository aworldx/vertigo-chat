defmodule ChatWeb.AccountLoginController do
  use ChatWeb, :controller

  def index(conn, _params) do
    conn
    |> assign(:disable_live_socket, true)
    |> render(:index, page_title: "Вход", meta_description: "Вход в аккаунт Vertigo.")
  end
end
