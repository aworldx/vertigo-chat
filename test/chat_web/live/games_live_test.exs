# Назначение файла: LiveView-тесты меню, лобби и игровых столов.
defmodule ChatWeb.GamesLiveTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Games
  alias Chat.Games.Game
  alias Chat.Repo

  test "shows the game catalog including checkers", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/games")
    assert has_element?(view, "#games-catalog")
    assert has_element?(view, "#game-card-checkers", "Шашки")
    assert has_element?(view, "#game-card-battleship", "Морской бой")
    assert has_element?(view, "#game-card-durak", "Дурак")
    assert has_element?(view, "#game-card-balda", "Балда")
    assert has_element?(view, "#game-card-durak.game-catalog-card--durak .game-catalog-card__art")
    assert has_element?(view, "#game-card-battleship.game-catalog-card--battleship")
  end

  test "authenticates a guest chatlan for the game lobby", %{conn: conn} do
    nickname = "guest_player"
    token = ChatWeb.UserAuth.sign_guest_identity(nickname)

    {:ok, view, _html} = live(conn, ~p"/games/balda")

    render_hook(view, "authenticate_games", %{
      "guest_nickname" => nickname,
      "guest_identity_token" => token
    })

    assert has_element?(view, "#games-lobby", "Ты вошёл как guest_player")
  end

  test "creates a battleship table and lets its owner prepare a fleet", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "live_games_host", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "live_games_guest", password: "secret123"})

    {:ok, view, _html} = live(conn, ~p"/games/battleship")
    render_hook(view, "authenticate_games", %{"token" => ChatWeb.UserAuth.sign(host)})
    assert has_element?(view, "#games-lobby", "live_games_host")

    view |> element("#create-game") |> render_click()
    assert has_element?(view, "#my-games", "Набираем игроков")
    [game] = Games.list_games(host, "battleship")
    assert {:ok, _game} = Games.join(opponent, game.id)

    view |> element("#start-game-#{game.id}") |> render_click()
    assert has_element?(view, "#fleet-setup")
    assert has_element?(view, "#fleet-controls")
    assert has_element?(view, "#fleet-cell-0-0")

    view |> element("#fleet-cell-0-0") |> render_click()
    assert has_element?(view, "#fleet-cell-0-0 .ship-token--battleship")

    view |> element("#place-fleet") |> render_click()
    assert render(view) =~ "Твой флот готов"
  end

  test "opens an active Balda game for a spectator", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "balda_live_host", password: "secret123"})
    {:ok, guest} = Accounts.register_user(%{nickname: "balda_live_guest", password: "secret123"})

    {:ok, spectator} =
      Accounts.register_user(%{nickname: "balda_live_spectator", password: "secret123"})

    {:ok, game} = Games.create(host, "balda")
    {:ok, game} = Games.join(guest, game.id)
    {:ok, game} = Games.start(host, game.id)
    {:ok, view, _html} = live(conn, ~p"/games/balda")
    render_hook(view, "authenticate_games", %{"token" => ChatWeb.UserAuth.sign(spectator)})

    assert has_element?(view, "#watch-game-#{game.id}")
    view |> element("#watch-game-#{game.id}") |> render_click()
    assert has_element?(view, "#active-game", "Режим зрителя")
    assert has_element?(view, "#balda-0-0.balda-tile[data-game-sound='tile'][disabled]")
  end

  test "shows the current turn and sunk-ship legend at an active battleship table", %{conn: conn} do
    {:ok, host} =
      Accounts.register_user(%{nickname: "battleship_live_host", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "battleship_live_guest", password: "secret123"})

    {:ok, game} = Games.create(host, "battleship")
    assert {:ok, game} = Games.join(opponent, game.id)
    assert {:ok, game} = Games.start(host, game.id)
    assert {:ok, game} = Games.place_fleet(host, game.id)
    assert {:ok, _game} = Games.place_fleet(opponent, game.id)

    {:ok, view, _html} = live(conn, ~p"/games/battleship")
    render_hook(view, "authenticate_games", %{"token" => ChatWeb.UserAuth.sign(host)})

    view |> element("#open-game-#{game.id}") |> render_click()

    assert has_element?(view, "#battleship-turn", "Твой ход")
    assert has_element?(view, "#battleship-sunk-status", "Полностью потопленные корабли")
  end

  test "shows a waiting table and joins it from the lobby", %{conn: conn} do
    {:ok, host} = Accounts.register_user(%{nickname: "waiting_host", password: "secret123"})
    {:ok, guest} = Accounts.register_user(%{nickname: "waiting_guest", password: "secret123"})
    {:ok, game} = Games.create(host, "balda")
    {:ok, view, _html} = live(conn, ~p"/games/balda")
    render_hook(view, "authenticate_games", %{"token" => ChatWeb.UserAuth.sign(guest)})

    assert has_element?(view, "#join-game-#{game.id}")
    view |> element("#join-game-#{game.id}") |> render_click()
    assert has_element?(view, "#game-#{game.id}", "waiting_host")
  end

  test "shows a victory screen when a finished game belongs to the winner", %{conn: conn} do
    {:ok, winner} = Accounts.register_user(%{nickname: "result_winner", password: "secret123"})

    {:ok, opponent} =
      Accounts.register_user(%{nickname: "result_opponent", password: "secret123"})

    assert {:ok, game} = Games.create(winner, "balda")
    assert {:ok, game} = Games.join(opponent, game.id)
    assert {:ok, game} = Games.start(winner, game.id)

    {:ok, view, _html} = live(conn, ~p"/games/balda")
    render_hook(view, "authenticate_games", %{"token" => ChatWeb.UserAuth.sign(winner)})
    view |> element("#open-game-#{game.id}") |> render_click()

    Repo.get!(Game, game.id)
    |> Game.changeset(%{status: "finished", winner_id: winner.id})
    |> Repo.update!()

    send(view.pid, {:game_updated, game.id})
    assert has_element?(view, "#game-result.game-result--victory", "Победа!")
    assert has_element?(view, "#return-to-games-lobby")
    view |> element("#return-to-games-lobby") |> render_click()
    refute has_element?(view, "#game-result")
  end
end
