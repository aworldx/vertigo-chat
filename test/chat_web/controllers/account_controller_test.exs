defmodule ChatWeb.AccountControllerTest do
  use ChatWeb.ConnCase

  alias Chat.{Accounts, Repo}
  alias Chat.Sessions.ChatSession
  alias Chat.Visits.Visit

  test "account login and logout do not create chat sessions or visits", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "site_member", "password" => "secret123"})

    conn =
      post(conn, ~p"/account/login", account: %{nickname: user.nickname, password: "secret123"})

    assert redirected_to(conn) == ~p"/library"
    assert get_session(conn, :account_user_id) == user.id
    assert Repo.aggregate(ChatSession, :count) == 0
    assert Repo.aggregate(Visit, :count) == 0

    conn = conn |> recycle() |> post(~p"/account/logout")
    assert get_session(conn, :account_user_id) == nil
    assert redirected_to(conn) == ~p"/library"
  end

  test "chat login exchanges only a fresh dedicated token for an account cookie", %{conn: conn} do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "bridge_member", "password" => "secret123"})

    token = ChatWeb.AccountAuth.sign_login(user)
    response = post(conn, ~p"/account/chat-login", %{token: token})
    assert response.status == 204
    assert get_session(response, :account_user_id) == user.id
    assert Repo.aggregate(ChatSession, :count) == 0
    assert Repo.aggregate(Visit, :count) == 0

    for invalid <- [
          "invalid",
          ChatWeb.UserAuth.sign(user),
          Phoenix.Token.sign(ChatWeb.Endpoint, "account-login", user.id,
            signed_at: System.system_time(:second) - 120
          )
        ] do
      rejected = post(conn, ~p"/account/chat-login", %{token: invalid})
      assert rejected.status == 401
      refute get_session(rejected, :account_user_id)
    end
  end

  test "login return destination rejects external and unsupported paths", %{conn: conn} do
    for path <- ["https://example.com", "//example.com", "/chat", "/games/unknown"] do
      response = post(conn, ~p"/account/login", %{"return_to" => path})
      assert redirected_to(response) == ~p"/library"
    end
  end

  test "invalid or incomplete credentials do not authorize the account", %{conn: conn} do
    for params <- [%{}, %{account: %{nickname: "missing", password: "wrong"}}] do
      response = post(conn, ~p"/account/login", params)
      assert redirected_to(response) == ~p"/library"
      refute get_session(response, :account_user_id)
    end
  end
end
