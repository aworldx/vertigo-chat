defmodule ChatWeb.AccountController do
  use ChatWeb, :controller

  alias Chat.Accounts

  def login(conn, %{"account" => %{"nickname" => nickname, "password" => password}} = params) do
    case Accounts.authenticate(nickname, password) do
      {:ok, user} ->
        conn
        |> configure_session(renew: true)
        |> put_session(:account_user_id, user.id)
        |> delete_session(:account_signed_out)
        |> redirect(to: login_return_path(params))

      _ ->
        conn
        |> put_flash(:error, "Неверный ник или пароль.")
        |> redirect(to: login_return_path(params))
    end
  end

  def login(conn, params),
    do:
      conn |> put_flash(:error, "Введи ник и пароль.") |> redirect(to: login_return_path(params))

  def chat_login(conn, %{"token" => token}) do
    case ChatWeb.AccountAuth.verify_login(token) do
      {:ok, user} ->
        conn
        |> configure_session(renew: true)
        |> put_session(:account_user_id, user.id)
        |> delete_session(:account_signed_out)
        |> send_resp(:no_content, "")

      {:error, _} ->
        send_resp(conn, :unauthorized, "Invalid login token")
    end
  end

  def chat_login(conn, _params), do: send_resp(conn, :unauthorized, "Missing login token")

  defp login_return_path(%{"return_to" => path})
       when path in [
              "/",
              "/profiles",
              "/profiles/react",
              "/visits",
              "/help",
              "/ranks",
              "/articles",
              "/articles/chats-vs-messengers",
              "/articles/chat-platforms-russia",
              "/articles/how-vertigo-chat-works",
              "/about",
              "/checkers",
              "/library",
              "/gallery",
              "/music-chart",
              "/games",
              "/games/battleship",
              "/games/durak",
              "/games/balda"
            ],
       do: path

  defp login_return_path(_params), do: ~p"/library"

  def logout(conn, params) do
    conn
    |> delete_session(:account_user_id)
    |> put_session(:account_signed_out, true)
    |> redirect(to: login_return_path(params))
  end
end
