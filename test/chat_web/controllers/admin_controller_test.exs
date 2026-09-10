defmodule ChatWeb.AdminControllerTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts

  test "shows a regular login form and lets an admin sign in", %{conn: conn} do
    assert get(conn, "/admin") |> response(:ok) =~ "admin-login-form"

    {:ok, admin} =
      Accounts.register_user(%{"nickname" => "admin_http", "password" => "secret123"})

    conn =
      post(conn, "/admin/login", %{
        "admin_auth" => %{"nickname" => admin.nickname, "password" => "secret123"}
      })

    assert redirected_to(conn) == "/admin"
    assert get(recycle(conn), "/admin") |> response(:ok) =~ "admin-feedback-section"
  end
end
