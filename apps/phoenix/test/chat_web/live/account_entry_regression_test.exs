defmodule ChatWeb.AccountEntryRegressionTest do
  use ChatWeb.ConnCase

  alias Chat.{Accounts, Repo}
  alias Chat.Sessions.ChatSession
  alias Chat.Visits.Visit

  for {section, path, authenticated_selector} <- [
        {"library", "/library", "#library-rank-hint"},
        {"gallery", "/gallery", "#gallery-rank-hint"},
        {"checkers", "/checkers", "#checkers-lobby"},
        {"music-chart", "/music-chart", "#music-chart-upload-form"},
        {"games", "/games", "#games-catalog"},
        {"games", "/games/battleship", "#games-lobby"},
        {"games", "/games/durak", "#games-lobby"},
        {"games", "/games/balda", "#games-lobby"}
      ] do
    @section section
    @path path
    @authenticated_selector authenticated_selector

    test "common account entry survives refresh at #{path}", %{conn: conn} do
      {:ok, user} =
        Accounts.register_user(%{"nickname" => "entry_member", "password" => "secret123"})

      {:ok, view, _} = live(conn, @path)
      selector = "##{@section}-account-login"
      assert has_element?(view, selector <> "[action='/account/login'][method='post']")
      assert has_element?(view, selector <> " input[name='return_to'][value='#{@path}']")
      assert has_element?(view, selector <> " input[autocomplete='username'][required]")

      assert has_element?(
               view,
               selector <> " input[type='password'][autocomplete='current-password'][required]"
             )

      assert has_element?(view, "##{@section}-account-submit", "Войти")

      response =
        view
        |> form(selector, account: %{nickname: user.nickname, password: "wrong"})
        |> submit_form(conn)

      assert redirected_to(response) == @path
      refute get_session(response, :account_user_id)
      {:ok, retry_view, _} = live(recycle(response), @path)
      assert has_element?(retry_view, "#flash-error", "Неверный ник или пароль")
      assert has_element?(retry_view, selector)

      response =
        retry_view
        |> form(selector, account: %{nickname: user.nickname, password: "secret123"})
        |> submit_form(recycle(response))

      assert redirected_to(response) == @path
      assert get_session(response, :account_user_id) == user.id

      for _ <- 1..2 do
        {:ok, signed_in_view, _} = live(recycle(response), @path)

        if @section in ["library", "gallery", "games", "checkers"] do
          render_hook(signed_in_view, "authenticate_#{@section}", %{})
        end

        refute has_element?(signed_in_view, selector)
        assert has_element?(signed_in_view, @authenticated_selector)
      end

      {:ok, signed_in_view, _} = live(recycle(response), @path)
      assert has_element?(signed_in_view, "#site-account-nickname", user.nickname)

      logout_response =
        signed_in_view |> form("#site-account-logout") |> submit_form(recycle(response))

      assert redirected_to(logout_response) == @path
      refute get_session(logout_response, :account_user_id)
      {:ok, signed_out_view, _} = live(recycle(logout_response), @path)

      if @section in ["library", "gallery", "games", "checkers"] do
        render_hook(signed_out_view, "authenticate_#{@section}", %{
          "token" => ChatWeb.UserAuth.sign(user)
        })
      end

      assert has_element?(signed_out_view, selector)
      refute has_element?(signed_out_view, "#site-account")

      assert Repo.aggregate(ChatSession, :count) == 0
      assert Repo.aggregate(Visit, :count) == 0
    end
  end
end
