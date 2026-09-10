defmodule ChatWeb.AdminController do
  use ChatWeb, :controller

  alias Chat.Accounts
  alias Chat.Admin

  @session_key :admin_user_id

  def index(conn, _params) do
    case current_admin(conn) do
      {:ok, user} ->
        {:ok, feedback} = Admin.list_feedback(user)
        {:ok, assessments} = Admin.list_karmik_assessments(user)
        {:ok, emojis} = Admin.list_emojis(user)
        render_page(conn, user, feedback, assessments, emojis)

      :error ->
        render_page(conn, nil, [], [], [])
    end
  end

  def login(conn, %{"admin_auth" => params}) do
    case Accounts.authenticate(params["nickname"], params["password"]) do
      {:ok, user} ->
        if Accounts.admin?(user),
          do: conn |> put_session(@session_key, user.id) |> redirect(to: ~p"/admin"),
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

  defp render_page(conn, user, feedback, assessments, emojis) do
    conn
    |> put_view(ChatWeb.AdminHTML)
    |> render(:index,
      current_user: user,
      feedback_entries: feedback,
      karmik_assessments: assessments,
      emojis: emojis,
      chat_version: Application.spec(:chat, :vsn) |> to_string()
    )
  end

  defp current_admin(conn) do
    case Accounts.get_user(get_session(conn, @session_key)) do
      user when not is_nil(user) -> if Accounts.admin?(user), do: {:ok, user}, else: :error
      nil -> :error
    end
  end
end
