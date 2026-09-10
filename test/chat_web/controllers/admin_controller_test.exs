defmodule ChatWeb.AdminControllerTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts

  test "shows a regular login form and lets an admin sign in", %{conn: conn} do
    response = get(conn, "/admin") |> response(:ok)
    assert response =~ "admin-login-form"
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
end
