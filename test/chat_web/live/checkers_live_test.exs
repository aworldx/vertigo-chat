# Назначение файла: LiveView-тест страницы шашек и её ключевых состояний.
defmodule ChatWeb.CheckersLiveTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Checkers

  test "renders authentication state and stable game containers", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/checkers")
    assert has_element?(view, "#checkers-page.games-page--checkers")
    assert has_element?(view, "#checkers-auth-check")
    render_hook(view, "authenticate_checkers", %{})
    assert has_element?(view, "#checkers-login-hint")
  end

  test "authenticates a registered chatlan and shows the game lobby", %{conn: conn} do
    {:ok, user} = Accounts.register_user(%{nickname: "checkers_host", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "checkers_opponent", password: "secret123"})

    {:ok, view, _html} = live(conn, ~p"/checkers")

    render_hook(view, "authenticate_checkers", %{"token" => ChatWeb.UserAuth.sign(user)})

    assert has_element?(view, "#checkers-lobby", "Ты вошёл как checkers_host")

    assert has_element?(
             view,
             "#checkers-invite-form option[value='#{opponent.id}']",
             "checkers_opponent"
           )

    assert has_element?(view, "#checkers-games-empty")
  end

  test "sends an invitation from the lobby", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "invite_host", password: "secret123"})
    {:ok, opponent} = Accounts.register_user(%{nickname: "invite_guest", password: "secret123"})
    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => ChatWeb.UserAuth.sign(host)})

    view
    |> form("#checkers-invite-form", invite: %{opponent_id: opponent.id})
    |> render_submit()

    assert has_element?(view, "#checkers-games", "Ждём ответа соперника.")
    assert render(view) =~ "Приглашение отправлено."
  end

  test "accepts an invitation and lets a player make a move", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "move_host", password: "secret123"})
    {:ok, opponent} = Accounts.register_user(%{nickname: "move_guest", password: "secret123"})
    {:ok, game} = Checkers.invite(host, opponent.id)
    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => ChatWeb.UserAuth.sign(opponent)})

    view |> element("#accept-game-#{game.id}") |> render_click()
    assert has_element?(view, "#active-checkers-game")

    view |> element("#square-2-1") |> render_click()
    assert has_element?(view, "#square-2-1.ring-4")

    assert has_element?(
             view,
             "#square-2-1.checker-square[data-game-sound='checker'] .checker-piece"
           )
  end

  test "opens an active game for a spectator", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "spectator_host", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "spectator_guest", password: "secret123"})

    {:ok, spectator} = Accounts.register_user(%{nickname: "spectator", password: "secret123"})
    {:ok, game} = Checkers.invite(host, opponent.id)
    {:ok, active_game} = Checkers.accept(opponent, game.id)
    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => ChatWeb.UserAuth.sign(spectator)})

    assert has_element?(view, "#watch-game-#{active_game.id}")
    view |> element("#watch-game-#{active_game.id}") |> render_click()

    assert has_element?(view, "#active-checkers-game", "Режим зрителя")
    assert has_element?(view, "#square-0-1[disabled]")
  end

  test "rejects an invalid authentication token", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => "invalid"})

    assert has_element?(view, "#checkers-login-hint")
  end
end
