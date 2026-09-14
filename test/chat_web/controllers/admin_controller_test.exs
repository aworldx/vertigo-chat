defmodule ChatWeb.AdminControllerTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Repo

  test "shows a regular login form and lets an admin sign in", %{conn: conn} do
    response = get(conn, "/admin") |> response(:ok)
    assert response =~ "admin-login-form"
    assert response =~ "name=\"_csrf_token\""
    assert response =~ "/assets/css/app.css"
    refute response =~ "/assets/js/app.js"

    {:ok, admin} =
      Accounts.register_user(%{"nickname" => "admin_http", "password" => "secret123"})

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => admin.nickname, "password" => "secret123"}
      })

    assert redirected_to(conn) == "/admin"
    response = get(recycle(conn), "/admin") |> response(:ok)
    assert response =~ "admin-database-table"
    assert response =~ "feedback_entries"
    assert response =~ "karmik_assessments"

    response = get(recycle(conn), "/admin?table=feedback_entries") |> response(:ok)
    assert response =~ "feedback_entries"
    refute response =~ "admin-login-form"
  end

  test "lets an emoji moderator sign in to moderation", %{conn: conn} do
    {:ok, _admin} =
      Accounts.register_user(%{"nickname" => "admin_owner", "password" => "secret123"})

    {:ok, moderator} =
      Accounts.register_user(%{"nickname" => "emoji_mod", "password" => "secret123"})

    {:ok, _moderator} =
      moderator
      |> Ecto.Changeset.change(can_moderate_emojis: true)
      |> Repo.update()

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => "emoji_mod", "password" => "secret123"}
      })

    assert redirected_to(conn) == "/admin"

    response = get(recycle(conn), "/admin") |> response(:ok)
    assert response =~ "admin-emojis-list"
    assert response =~ ">Теги</a>"
    refute response =~ "admin-database-table"
  end
end
