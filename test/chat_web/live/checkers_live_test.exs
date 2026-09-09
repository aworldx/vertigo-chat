# Назначение файла: LiveView-тест страницы шашек и её ключевых состояний.
defmodule ChatWeb.CheckersLiveTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Checkers
  alias Chat.Checkers.Game
  alias Chat.Repo

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
    assert has_element?(view, "#checkers-invite-panel", "Новая партия")
    assert has_element?(view, "#send-checkers-invite", "Пригласить")

    assert has_element?(
             view,
             "#checkers-invite-form option[value='#{opponent.id}']",
             "checkers_opponent"
           )

    assert has_element?(view, "#checkers-games-empty")
  end

  test "authenticates a guest chatlan with a signed guest identity", %{conn: conn} do
    nickname = "guest_checker"
    token = ChatWeb.UserAuth.sign_guest_identity(nickname)

    {:ok, view, _html} = live(conn, ~p"/checkers")

    render_hook(view, "authenticate_checkers", %{
      "guest_nickname" => nickname,
      "guest_identity_token" => token
    })

    assert has_element?(view, "#checkers-lobby", "Ты вошёл как guest_checker")
  end

  test "lets two guest chatlans create, accept, and play a checkers move", %{conn: conn} do
    host_nickname = "guest_host"
    opponent_nickname = "guest_opponent"
    host_identity_id = Ecto.UUID.generate()
    opponent_identity_id = Ecto.UUID.generate()

    {:ok, host_view, _html} = live(conn, ~p"/checkers")
    {:ok, opponent_view, _html} = live(build_conn(), ~p"/checkers")

    render_hook(host_view, "authenticate_checkers", %{
      "guest_nickname" => host_nickname,
      "guest_identity_token" =>
        ChatWeb.UserAuth.sign_guest_identity(host_nickname, host_identity_id)
    })

    render_hook(opponent_view, "authenticate_checkers", %{
      "guest_nickname" => opponent_nickname,
      "guest_identity_token" =>
        ChatWeb.UserAuth.sign_guest_identity(opponent_nickname, opponent_identity_id)
    })

    [opponent] =
      Chat.Checkers.list_opponents(
        Accounts.ensure_game_guest(host_nickname, host_identity_id)
        |> elem(1)
      )

    assert has_element?(
             host_view,
             "#checkers-invite-form option[value='#{opponent.id}']",
             opponent_nickname
           )

    host_view
    |> form("#checkers-invite-form", invite: %{opponent_id: opponent.id})
    |> render_submit()

    assert [game] = Chat.Checkers.list_games(opponent)
    opponent_view |> element("#accept-game-#{game.id}") |> render_click()
    assert has_element?(host_view, "#active-checkers-game")

    host_view |> element("#square-5-0") |> render_click()
    host_view |> element("#square-4-1") |> render_click()

    assert has_element?(host_view, "#square-4-1 .checker-piece")
    assert has_element?(host_view, "#checkers-turn", "Ходят чёрные")
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

  test "shows a victory screen when a finished checkers game belongs to the winner", %{conn: conn} do
    {:ok, winner} =
      Accounts.register_user(%{nickname: "checker_result_winner", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "checker_result_opponent", password: "secret123"})

    assert {:ok, game} = Checkers.invite(winner, opponent.id)
    assert {:ok, game} = Checkers.accept(opponent, game.id)

    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => ChatWeb.UserAuth.sign(winner)})
    view |> element("#open-game-#{game.id}") |> render_click()

    Repo.get!(Game, game.id)
    |> Ecto.Changeset.change(status: "finished", winner_id: winner.id)
    |> Repo.update!()

    send(view.pid, {:game_updated, game.id})
    assert has_element?(view, "#checkers-result.game-result--victory", "Победа!")
    assert has_element?(view, "#return-to-checkers-lobby")
    view |> element("#return-to-checkers-lobby") |> render_click()
    refute has_element?(view, "#checkers-result")
  end

  test "rejects an invalid authentication token", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/checkers")
    render_hook(view, "authenticate_checkers", %{"token" => "invalid"})

    assert has_element?(view, "#checkers-login-hint")
  end
end
