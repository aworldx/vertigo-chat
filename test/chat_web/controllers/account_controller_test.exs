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

  test "invalid or incomplete credentials do not authorize the account", %{conn: conn} do
    for params <- [%{}, %{account: %{nickname: "missing", password: "wrong"}}] do
      response = post(conn, ~p"/account/login", params)
      assert redirected_to(response) == ~p"/library"
      refute get_session(response, :account_user_id)
    end
  end
end
