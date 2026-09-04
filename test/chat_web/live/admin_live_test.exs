defmodule ChatWeb.AdminLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Feedback
  alias Chat.Security.Subject
  alias ChatWeb.UserAuth

  test "keeps feedback hidden until an administrator authenticates", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/admin")

    assert has_element?(view, "#admin-login-required")
    assert has_element?(view, "#admin-login-form")
    refute has_element?(view, "#admin-feedback-list")
  end

  test "lets an administrator sign in directly from the admin page", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "direct_admin", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/admin")

    view
    |> form("#admin-login-form", admin_auth: %{nickname: admin.nickname, password: "secret123"})
    |> render_submit()

    assert has_element?(view, "#admin-feedback-section")
  end

  test "renders feedback for an authenticated administrator", %{conn: conn} do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "admin_reader", "password" => "secret123"})

    assert {:ok, _entry} =
             Feedback.submit(
               nil,
               %{"name" => "Гость", "body" => "Добавьте поиск по истории"},
               Subject.internal(:admin_live_feedback)
             )

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(admin)})
      |> live(~p"/admin")

    assert has_element?(view, "#admin-feedback-section")
    assert has_element?(view, "#admin-feedback-list article", "Добавьте поиск по истории")
    assert has_element?(view, "#admin-feedback-count", "1")
  end

  test "denies a registered non-administrator", %{conn: conn} do
    assert {:ok, _admin} =
             Accounts.register_user(%{"nickname" => "primary_admin", "password" => "secret123"})

    assert {:ok, member} =
             Accounts.register_user(%{"nickname" => "regular_member", "password" => "secret123"})

    {:ok, view, _html} =
      conn
      |> put_connect_params(%{"user_auth_token" => UserAuth.sign(member)})
      |> live(~p"/admin")

    assert has_element?(view, "#admin-forbidden", "regular_member")
    refute has_element?(view, "#admin-feedback-list")
  end
end
