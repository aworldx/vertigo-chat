defmodule ChatWeb.API.V1.AccountProfileController do
  use ChatWeb, :controller

  alias Chat.Accounts
  alias Chat.Profiles

  def show(conn, _params) do
    with %{} = user <- current_user(conn),
         {:ok, profile} <- Profiles.get_by_nickname(user.nickname) do
      render(conn, :show, profile: profile)
    else
      _ -> unauthorized(conn)
    end
  end

  def update(conn, %{"profile" => attrs}) when is_map(attrs) do
    with %{} = user <- current_user(conn),
         :ok <- validate_profile_attrs(attrs),
         {:ok, profile} <- Profiles.get_by_nickname(user.nickname),
         {:ok, profile} <- Profiles.update_profile(user, profile, attrs) do
      render(conn, :show, profile: profile)
    else
      {:error, %Ecto.Changeset{} = changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          error: %{
            code: "invalid_profile",
            message: "Проверь поля анкеты.",
            fields: errors(changeset)
          }
        })

      {:error, :invalid_attrs} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: %{code: "invalid_profile", message: "Проверь поля анкеты."}})

      _ ->
        unauthorized(conn)
    end
  end

  def update(conn, _params),
    do:
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: %{code: "invalid_profile", message: "Проверь поля анкеты."}})

  def put_photo(conn, %{"photo" => %Plug.Upload{path: path, content_type: content_type}}) do
    with %{} = user <- current_user(conn),
         {:ok, profile} <- Profiles.get_by_nickname(user.nickname),
         {:ok, bytes} <- File.read(path),
         {:ok, profile} <- Profiles.put_photo(user, profile, bytes, content_type) do
      render(conn, :show, profile: profile)
    else
      nil ->
        unauthorized(conn)

      _ ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          error: %{
            code: "invalid_photo",
            message: "Фото должно быть JPG, PNG или WebP и не больше 1,5 МБ."
          }
        })
    end
  end

  def put_photo(conn, _params) do
    if current_user(conn) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: %{code: "invalid_photo", message: "Выбери подходящее фото."}})
    else
      unauthorized(conn)
    end
  end

  defp current_user(conn), do: conn |> get_session(:account_user_id) |> Accounts.get_user()

  defp validate_profile_attrs(attrs) do
    if Map.keys(attrs) -- ~w(name birth_date gender about) == [],
      do: :ok,
      else: {:error, :invalid_attrs}
  end

  defp unauthorized(conn),
    do:
      conn
      |> put_status(:unauthorized)
      |> json(%{error: %{code: "unauthorized", message: "Войди, чтобы редактировать анкету."}})

  defp errors(changeset),
    do: Ecto.Changeset.traverse_errors(changeset, fn {message, _opts} -> message end)
end
