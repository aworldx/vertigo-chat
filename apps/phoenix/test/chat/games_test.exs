# Назначение файла: тесты жизненного цикла, доступа и рейтинга новых игр.
defmodule Chat.GamesTest do
  use Chat.DataCase, async: true

  alias Chat.Accounts
  alias Chat.Games
  alias Chat.Games.Game
  alias Chat.Repo

  setup do
    users =
      for number <- 1..5 do
        {:ok, user} =
          Accounts.register_user(%{nickname: "game_player_#{number}", password: "secret123"})

        user
      end

    %{users: users}
  end

  test "battleship starts after both fleets are ready, enforces turns, and hides the opponent fleet",
       %{users: [host, opponent, spectator | _]} do
    assert {:ok, game} = Games.create(host, "battleship")
    assert [%{id: game_id}] = Games.list_waiting_games(opponent, "battleship")
    assert game_id == game.id
    assert {:ok, game} = Games.join(opponent, game.id)
    assert {:ok, game} = Games.start(host, game.id)
    assert {:ok, game} = Games.place_fleet(host, game.id)
    assert game.status == "waiting"
    assert {:ok, game} = Games.place_fleet(opponent, game.id)
    assert game.status == "active"

    assert {:error, :invalid_shot} = Games.shoot(opponent, game.id, "0,0")
    assert {:ok, game} = Games.shoot(host, game.id, "0,0")
    assert game.state["shots"][Integer.to_string(host.id)]["0,0"] in ["hit", "miss"]

    assert {:ok, host_view} = Games.get_game(host, game.id)
    assert map_size(host_view.state["boards"]) == 1
    assert {:ok, spectator_view} = Games.get_game(spectator, game.id)
    assert spectator_view.state["boards"] == %{}
  end

  test "battleship fleet setup opens only after both players join and the creator starts", %{
    users: [host, opponent | _]
  } do
    assert {:ok, game} = Games.create(host, "battleship")
    assert {:error, :unavailable} = Games.place_fleet(host, game.id)

    assert {:ok, game} = Games.join(opponent, game.id)
    assert {:error, :unavailable} = Games.place_fleet(host, game.id)

    assert {:ok, game} = Games.start(host, game.id)
    assert {:ok, game} = Games.place_fleet(host, game.id)
    assert game.status == "waiting"
  end

  test "accepts a manually arranged fleet and reports a fully sunk ship", %{
    users: [host, opponent | _]
  } do
    fleet = manual_fleet()

    assert {:error, :invalid_fleet} =
             Games.place_fleet(host, 0, [%{"cells" => ["0,0", "0,1", "0,2", "0,3"]}])

    assert {:ok, game} = Games.create(host, "battleship")
    assert {:ok, game} = Games.join(opponent, game.id)
    assert {:ok, game} = Games.start(host, game.id)
    assert {:ok, game} = Games.place_fleet(host, game.id, fleet)
    assert {:ok, game} = Games.place_fleet(opponent, game.id, fleet)
    assert game.status == "active"
    assert game.state["turn_id"] == host.id

    Enum.reduce(["0,0", "0,1", "0,2", "0,3"], game, fn square, current_game ->
      assert {:ok, next_game} = Games.shoot(host, current_game.id, square)
      next_game
    end)

    assert {:ok, host_view} = Games.get_game(host, game.id)
    assert host_view.state["sunk_cells"]["target"] == ["0,0", "0,1", "0,2", "0,3"]
    assert host_view.state["turn_id"] == host.id

    assert {:ok, opponent_view} = Games.get_game(opponent, game.id)
    assert opponent_view.state["sunk_cells"]["own"] == ["0,0", "0,1", "0,2", "0,3"]
    assert opponent_view.state["received_shots"]["0,0"] == "hit"
  end

  test "durak supports four players and keeps cards private", %{
    users: [first, second, third, fourth, spectator]
  } do
    assert {:ok, game} = Games.create(first, "durak")
    assert {:ok, game} = Games.join(second, game.id)
    assert {:ok, game} = Games.join(third, game.id)
    assert {:ok, game} = Games.join(fourth, game.id)
    assert {:error, :full} = Games.join(spectator, game.id)
    assert {:ok, game} = Games.start(first, game.id)
    assert game.status == "active"

    full_game = Repo.get!(Game, game.id)
    dealt_cards = full_game.state["hands"] |> Map.values() |> List.flatten()
    assert length(dealt_cards ++ full_game.state["deck"]) == 36
    assert length(Enum.uniq(dealt_cards ++ full_game.state["deck"])) == 36

    assert {:ok, first_view} = Games.get_game(first, game.id)
    assert length(first_view.state["hands"][Integer.to_string(first.id)]) == 6
    assert Map.has_key?(first_view.state["hand_counts"], Integer.to_string(second.id))
    refute Map.has_key?(first_view.state["hands"], Integer.to_string(second.id))

    card = hd(first_view.state["hands"][Integer.to_string(first.id)])
    assert {:ok, _game} = Games.play_card(first, game.id, card)
    assert {:ok, spectator_view} = Games.get_game(spectator, game.id)
    assert spectator_view.state["hands"] == %{}
  end

  test "durak lets attackers throw in matching ranks up to the defender's opening hand", %{
    users: [first, defender, third | _]
  } do
    assert {:ok, game} = Games.create(first, "durak")
    assert {:ok, game} = Games.join(defender, game.id)
    assert {:ok, game} = Games.join(third, game.id)
    assert {:ok, game} = Games.start(first, game.id)

    state = %{
      "deck" => ["A-♣"],
      "hands" => %{
        Integer.to_string(first.id) => ["6-♠", "6-♥", "6-♣"],
        Integer.to_string(defender.id) => ["7-♠", "8-♠", "9-♠"],
        Integer.to_string(third.id) => ["6-♦"]
      },
      "trump" => "A-♣",
      "table" => [],
      "attacker_id" => first.id,
      "defender_id" => defender.id,
      "defender_hand_size" => 3,
      "turn_id" => first.id,
      "phase" => "attack"
    }

    game |> Game.changeset(%{state: state}) |> Repo.update!()

    assert {:ok, game} = Games.play_card(first, game.id, "6-♠")
    assert game.state["phase"] == "defend"
    assert {:ok, game} = Games.play_card(first, game.id, "6-♥")
    assert {:ok, game} = Games.play_card(third, game.id, "6-♦")
    assert Enum.map(game.state["table"], & &1["attack"]) == ["6-♠", "6-♥", "6-♦"]
    assert {:error, :invalid_card} = Games.play_card(first, game.id, "6-♣")
  end

  test "balda validates the board path, awards points and rotates turns", %{
    users: [first, second | _]
  } do
    assert {:ok, game} = Games.create(first, "balda")
    assert {:ok, game} = Games.join(second, game.id)
    assert {:ok, game} = Games.start(first, game.id)

    initial_word =
      for col <- 0..4, into: "", do: game.state["board"]["2,#{col}"]

    assert initial_word == "САЛАТ"
    refute initial_word == "БАЛДА"

    assert {:error, :invalid_word} = Games.play_word(first, game.id, "0,0", "Я", "ЯЯЯ")
    assert {:ok, game} = Games.play_word(first, game.id, "1,1", "С", "САЛ")
    assert game.state["turn_id"] == second.id
    assert Enum.find(game.players, &(&1.user_id == first.id)).score == 3
    assert {:error, :forbidden} = Games.skip(first, game.id)
    assert {:ok, _game} = Games.skip(second, game.id)
  end

  test "leaderboard aggregates finished games by kind", %{users: [winner, other | _]} do
    assert {:ok, game} = Games.create(winner, "balda")
    assert {:ok, game} = Games.join(other, game.id)

    game
    |> Game.changeset(%{status: "finished", winner_id: winner.id})
    |> Repo.update!()

    assert [%{user: user, wins: 1, played: 1}, %{wins: 0, played: 1}] = Games.leaderboard("balda")
    assert user.id == winner.id
  end

  test "removes abandoned waiting games but keeps finished games", %{users: [host, opponent | _]} do
    assert {:ok, waiting_game} = Games.create(host, "balda")
    assert {:ok, finished_game} = Games.create(opponent, "balda")

    finished_game
    |> Game.changeset(%{status: "finished", winner_id: opponent.id})
    |> Repo.update!()

    stale_at = DateTime.add(DateTime.utc_now(), -25 * 60 * 60, :second)

    game_ids = [waiting_game.id, finished_game.id]

    Repo.update_all(from(game in Game, where: game.id in ^game_ids),
      set: [updated_at: stale_at]
    )

    assert Games.cleanup_stale_games() == 1
    assert {:error, :not_found} = Games.get_game(host, waiting_game.id)
    assert Repo.get(Game, finished_game.id)
  end

  defp manual_fleet do
    Enum.reduce(
      [
        {"0,0", 4},
        {"2,0", 3},
        {"4,0", 3},
        {"6,0", 2},
        {"6,3", 2},
        {"8,0", 2},
        {"8,3", 1},
        {"8,5", 1},
        {"8,7", 1},
        {"5,6", 1}
      ],
      [],
      fn {square, size}, fleet ->
        assert {:ok, fleet} = Games.add_fleet_ship(fleet, square, size, "horizontal")
        fleet
      end
    )
  end
end
