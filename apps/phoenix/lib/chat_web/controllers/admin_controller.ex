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
        {:ok, emoji_tags} = Admin.list_emoji_tags(user)
        selected_emoji = Enum.find(emojis, &(&1.id == selected_emoji_id(params)))

        if Accounts.admin?(user) do
          case Admin.database_overview(user, params["table"]) do
            {:ok, database} ->
              render_page(
                conn,
                user,
                database,
                emojis,
                emoji_tags,
                selected_section(params, user),
                selected_emoji
              )

            {:error, :database} ->
              conn
              |> put_flash(:error, "Не удалось загрузить данные.")
              |> render_page(
                user,
                empty_database(),
                emojis,
                emoji_tags,
                selected_section(params, user),
                selected_emoji
              )
          end
        else
          render_page(
            conn,
            user,
            empty_database(),
            emojis,
            emoji_tags,
            selected_section(params, user),
            selected_emoji
          )
        end

      :error ->
        render_page(conn, nil, empty_database(), [], [], :database, nil)
    end
  end

  def login(conn, %{"admin_auth" => params}) do
    case Accounts.authenticate(params["nickname"], params["password"]) do
      {:ok, user} ->
        if Accounts.emoji_moderator?(user),
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
      conn
      |> put_flash(:info, "Смайл отправлен в очередь модерации.")
      |> redirect(to: ~p"/admin?section=emojis")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось добавить смайл.")
        |> redirect(to: ~p"/admin?section=emojis")
    end
  end

  def upload_emoji(conn, _params),
    do:
      conn
      |> put_flash(:error, "Выберите файл PNG, WebP или GIF.")
      |> redirect(to: ~p"/admin?section=emojis")

  def moderate_emoji(conn, %{"id" => id, "emoji" => attrs}) do
    with {:ok, user} <- current_admin(conn),
         {emoji_id, ""} <- Integer.parse(id),
         {:ok, _emoji} <- Admin.moderate_emoji(user, emoji_id, attrs) do
      conn |> put_flash(:info, "Смайл обновлён.") |> redirect(to: ~p"/admin?section=emojis")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось обновить смайл.")
        |> redirect(to: ~p"/admin?section=emojis")
    end
  end

  def delete_emoji(conn, %{"id" => id}) do
    with {:ok, user} <- current_admin(conn),
         {emoji_id, ""} <- Integer.parse(id),
         {:ok, _emoji} <- Admin.delete_emoji(user, emoji_id) do
      conn |> put_flash(:info, "Смайл удалён.") |> redirect(to: ~p"/admin?section=emojis")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось удалить смайл.")
        |> redirect(to: ~p"/admin?section=emojis")
    end
  end

  def create_emoji_tag(conn, %{"emoji_tag" => attrs}) do
    with {:ok, user} <- current_admin(conn), {:ok, _tag} <- Admin.create_emoji_tag(user, attrs) do
      conn |> put_flash(:info, "Тег добавлен.") |> redirect(to: ~p"/admin?section=tags")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось добавить тег.")
        |> redirect(to: ~p"/admin?section=tags")
    end
  end

  def update_emoji_tag(conn, %{"id" => id, "emoji_tag" => attrs}) do
    with {:ok, user} <- current_admin(conn),
         {tag_id, ""} <- Integer.parse(id),
         {:ok, _tag} <- Admin.update_emoji_tag(user, tag_id, attrs) do
      conn |> put_flash(:info, "Тег обновлён.") |> redirect(to: ~p"/admin?section=tags")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось обновить тег.")
        |> redirect(to: ~p"/admin?section=tags")
    end
  end

  def delete_emoji_tag(conn, %{"id" => id}) do
    with {:ok, user} <- current_admin(conn),
         {tag_id, ""} <- Integer.parse(id),
         {:ok, _tag} <- Admin.delete_emoji_tag(user, tag_id) do
      conn |> put_flash(:info, "Тег удалён.") |> redirect(to: ~p"/admin?section=tags")
    else
      _ ->
        conn
        |> put_flash(:error, "Не удалось удалить тег.")
        |> redirect(to: ~p"/admin?section=tags")
    end
  end

  defp render_page(conn, user, database, emojis, emoji_tags, selected_section, selected_emoji) do
    conn
    |> assign(:admin_assets, true)
    |> assign(:disable_live_socket, true)
    |> put_view(ChatWeb.AdminHTML)
    |> render(:index,
      current_user: user,
      is_admin?: Accounts.admin?(user),
      selected_section: selected_section,
      selected_emoji: selected_emoji,
      emojis: emojis,
      emoji_groups: group_emojis(emojis),
      emoji_tags: emoji_tags,
      database: database,
      chat_version: Application.spec(:chat, :vsn) |> to_string()
    )
  end

  defp empty_database, do: %{tables: [], selected_table: nil, columns: [], rows: []}

  defp selected_section(%{"section" => "emojis"}, _user), do: :emojis
  defp selected_section(%{"section" => "tags"}, _user), do: :tags

  defp selected_section(_params, %Chat.Accounts.User{} = user),
    do: if(Accounts.admin?(user), do: :database, else: :emojis)

  defp selected_emoji_id(%{"emoji_id" => id}) when is_binary(id) do
    case Integer.parse(id) do
      {emoji_id, ""} when emoji_id > 0 -> emoji_id
      _ -> nil
    end
  end

  defp selected_emoji_id(_params), do: nil

  defp group_emojis(emojis) do
    %{
      pending: Enum.filter(emojis, &(&1.status == :pending)),
      approved: Enum.filter(emojis, &(&1.status == :approved)),
      rejected: Enum.filter(emojis, &(&1.status == :rejected))
    }
  end

  defp current_admin(conn) do
    conn = fetch_cookies(conn)

    with token when is_binary(token) <- Map.get(conn.req_cookies, @admin_cookie),
         {:ok, user_id} <-
           Phoenix.Token.verify(ChatWeb.Endpoint, @admin_cookie_salt, token,
             max_age: @admin_session_max_age
           ),
         user when not is_nil(user) <- Accounts.get_user(user_id),
         true <- Accounts.emoji_moderator?(user) do
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
