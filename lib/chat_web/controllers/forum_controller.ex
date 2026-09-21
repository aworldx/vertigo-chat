# Назначение файла: web-адаптер DiscourseConnect, использующий сессию аккаунта чата.
defmodule ChatWeb.ForumController do
  use ChatWeb, :controller

  alias Chat.{Accounts, Forum, Profiles}

  def discourse_connect(conn, params) do
    case current_user(conn) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> text("Войди в аккаунт чата перед переходом на форум.")

      user ->
        case Forum.discourse_connect_response(user, params, avatar_url(user)) do
          {:ok, response} ->
            redirect(conn,
              external:
                response.return_url <>
                  "?" <> URI.encode_query(sso: response.sso, sig: response.sig)
            )

          {:error, :email_required} ->
            conn
            |> put_status(:unprocessable_entity)
            |> text("Добавь email в настройках аккаунта чата перед переходом на форум.")

          {:error, :not_configured} ->
            send_resp(conn, :not_found, "")

          {:error, :invalid_request} ->
            send_resp(conn, :bad_request, "Invalid DiscourseConnect request")
        end
    end
  end

  defp current_user(conn) do
    conn |> get_session(:account_user_id) |> Accounts.get_user()
  end

  defp avatar_url(user) do
    with {:ok, %{photo: photo, photo_key: photo_key}} <- Profiles.get_by_nickname(user.nickname),
         true <- is_binary(photo) or is_binary(photo_key) do
      ChatWeb.Endpoint.url() <> "/profiles/" <> URI.encode(user.nickname) <> "/photo"
    else
      _ -> nil
    end
  end
end
