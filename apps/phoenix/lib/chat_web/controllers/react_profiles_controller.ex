defmodule ChatWeb.ReactProfilesController do
  use ChatWeb, :controller

  def index(conn, _params) do
    conn
    |> assign(:disable_live_socket, true)
    |> assign(:react_profiles, true)
    |> render(:index,
      page_title: "Анкеты",
      meta_description: "Анкеты участников Vertigo.",
      robots: "noindex, follow",
      current_account_user: Chat.Accounts.get_user(get_session(conn, :account_user_id))
    )
  end
end
