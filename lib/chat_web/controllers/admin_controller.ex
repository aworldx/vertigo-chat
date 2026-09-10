defmodule ChatWeb.AdminController do
  use ChatWeb, :controller

  alias Chat.Accounts
  alias Chat.Admin

  @admin_cookie "vertigo_admin"
  @admin_cookie_salt "admin-session"
  @admin_session_max_age 30 * 24 * 60 * 60

  def index(conn, params) do
    case current_admin(conn) do
      {:ok, user} ->
        {:ok, emojis} = Admin.list_emojis(user)

        case Admin.database_overview(user, params["table"]) do
          {:ok, database} ->
            render_page(conn, user, database, emojis)

          {:error, :database} ->
            conn
            |> put_flash(:error, "Не удалось загрузить данные.")
            |> render_page(user, empty_database(), emojis)
        end

      :error ->
        render_page(conn, nil, empty_database(), [])
    end
  end

  def login(conn, %{"admin_auth" => params}) do
    case Accounts.authenticate(params["nickname"], params["password"]) do
      {:ok, user} ->
        if Accounts.admin?(user),
          do: conn |> put_admin_cookie(user) |> redirect(to: ~p"/admin"),
          else: conn |> put_flash(:error, "Недостаточно прав.") |> redirect(to: ~p"/admin")

      _ ->
        conn |> put_flash(:error, "Неверный ник или пароль.") |> redirect(to: ~p"/admin")
    end
  end

  def upload_emoji(conn, %{"emoji" => %{"code" => code, "image" => %Plug.Upload{} = upload}}) do
    with {:ok, user} <- current_admin(conn),
         {:ok, image} <- File.read(upload.path),
         {:ok, _emoji} <- Admin.create_emoji(user, code, image, upload.content_type) do
      conn |> put_flash(:info, "Смайл добавлен.") |> redirect(to: ~p"/admin")
    else
      _ -> conn |> put_flash(:error, "Не удалось добавить смайл.") |> redirect(to: ~p"/admin")
    end
  end

  def upload_emoji(conn, _params),
    do: conn |> put_flash(:error, "Выберите PNG-файл.") |> redirect(to: ~p"/admin")

  defp render_page(conn, user, database, emojis) do
    conn
    |> assign(:admin_assets, true)
    |> assign(:disable_live_socket, true)
    |> put_view(ChatWeb.AdminHTML)
    |> render(:index,
      current_user: user,
      emojis: emojis,
      database: database,
      chat_version: Application.spec(:chat, :vsn) |> to_string()
    )
  end

  defp empty_database, do: %{tables: [], selected_table: nil, columns: [], rows: []}

  defp current_admin(conn) do
    conn = fetch_cookies(conn)

    with token when is_binary(token) <- Map.get(conn.req_cookies, @admin_cookie),
         {:ok, user_id} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @admin_cookie_salt, token,
             max_age: @admin_session_max_age
           ),
         user when not is_nil(user) <- Accounts.get_user(user_id),
         true <- Accounts.admin?(user) do
      {:ok, user}
    else
      _ -> :error
    end
  end

  defp put_admin_cookie(conn, user) do
    token = Phoenix.Token.sign(ChatWeb.Endpoint, @admin_cookie_salt, user.id)

    put_resp_cookie(conn, @admin_cookie, token,
      max_age: @admin_session_max_age,
      http_only: true,
      path: "/admin",
      same_site: "Lax",
      secure: secure_cookie?()
    )
  end

  defp secure_cookie? do
    ChatWeb.Endpoint.config(:url)
    |> Keyword.get(:scheme, "http")
    |> Kernel.==("https")
  end
end
