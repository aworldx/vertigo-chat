defmodule ChatWeb.AccountController do
  use ChatWeb, :controller

  alias Chat.Accounts

  def login(conn, %{"account" => %{"nickname" => nickname, "password" => password}}) do
    case Accounts.authenticate(nickname, password) do
      {:ok, user} ->
        conn
        |> configure_session(renew: true)
        |> put_session(:account_user_id, user.id)
        |> redirect(to: ~p"/library")

      _ ->
        conn |> put_flash(:error, "Неверный ник или пароль.") |> redirect(to: ~p"/library")
    end
  end

  def login(conn, _params),
    do: conn |> put_flash(:error, "Введи ник и пароль.") |> redirect(to: ~p"/library")

  def logout(conn, _params),
    do: conn |> delete_session(:account_user_id) |> redirect(to: ~p"/library")
end
