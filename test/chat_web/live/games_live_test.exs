# Назначение файла: LiveView-тесты меню, лобби и игровых столов.
defmodule ChatWeb.GamesLiveTest do
  use ChatWeb.ConnCase, async: true

  alias Chat.Accounts
  alias Chat.Games

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
end
