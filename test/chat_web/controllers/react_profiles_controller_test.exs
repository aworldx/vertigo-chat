defmodule ChatWeb.ReactProfilesControllerTest do
  use ChatWeb.ConnCase, async: true

  test "serves a standalone React entry without starting the LiveView client", %{conn: conn} do
    body = conn |> get(~p"/profiles/react") |> html_response(200)
    assert body =~ ~s(id="react-profiles-root")
    assert body =~ ~s(src="/assets/js/profiles.js")
    refute body =~ ~s(src="/assets/js/app.js")
    assert body =~ ~s(name="robots" content="noindex, follow")
    assert body =~ ~s(href="/profiles")
  end

  test "preserves account navigation and logout return destination", %{conn: conn} do
    {:ok, user} =
      Chat.Accounts.register_user(%{"nickname" => "react_account", "password" => "secret123"})

    conn = init_test_session(conn, account_user_id: user.id)
    body = conn |> get(~p"/profiles/react") |> html_response(200)
    assert body =~ ~s(id="site-account-nickname")
    assert body =~ "react_account"
    assert body =~ ~s(value="/profiles/react")

    response = post(conn, ~p"/account/logout", %{"return_to" => "/profiles/react"})
    assert redirected_to(response) == "/profiles/react"
    assert get_session(response, :account_user_id) == nil
  end
end
