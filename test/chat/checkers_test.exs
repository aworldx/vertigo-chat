# Назначение файла: тесты приглашений, прав и основных правил шашек.
defmodule Chat.CheckersTest do
  use Chat.DataCase, async: true

  alias Chat.Accounts
  alias Chat.Checkers
  alias Chat.Checkers.Game
  alias Chat.Repo

  setup do
    {:ok, first} = Accounts.register_user(%{nickname: "player_one", password: "secret123"})
    {:ok, second} = Accounts.register_user(%{nickname: "player_two", password: "secret123"})
    {:ok, third} = Accounts.register_user(%{nickname: "player_three", password: "secret123"})
    %{first: first, second: second, third: third}
  end

  test "invites another user and only the opponent can accept", %{
    first: first,
    second: second,
    third: third
  } do
    assert {:ok, game} = Checkers.invite(first, second.id)
    assert game.status == "pending"
    assert {:error, :forbidden} = Checkers.accept(third, game.id)
    assert {:ok, accepted} = Checkers.accept(second, game.id)
    assert accepted.status == "active"
    assert accepted.white_id == first.id
  end

  test "rejects duplicate open invitations and self invitation", %{first: first, second: second} do
    assert {:error, :invalid_opponent} = Checkers.invite(first, first.id)
    assert {:ok, _game} = Checkers.invite(first, second.id)
    assert {:error, :already_open} = Checkers.invite(second, first.id)
  end

  test "moves pieces in turn and rejects an opponent move", %{first: first, second: second} do
    assert {:ok, game} = Checkers.invite(first, second.id)
    assert {:ok, game} = Checkers.accept(second, game.id)
    assert {:error, :invalid_move} = Checkers.move(second, game.id, "2,1", "3,0")
    assert {:ok, game} = Checkers.move(first, game.id, "5,0", "4,1")
    assert game.board["4,1"] == "w"
    assert is_nil(game.board["5,0"])
    assert game.turn == "black"
  end

  test "requires a capture and records the winner", %{first: first, second: second} do
    assert {:ok, game} = Checkers.invite(first, second.id)
    assert {:ok, game} = Checkers.accept(second, game.id)

    game
    |> Ecto.Changeset.change(board: %{"2,1" => "w", "1,2" => "b", "5,4" => "w"}, turn: "white")
    |> Repo.update!()

    assert {:error, :invalid_move} = Checkers.move(first, game.id, "5,4", "4,3")
    assert {:ok, finished} = Checkers.move(first, game.id, "2,1", "0,3")
    assert finished.status == "finished"
    assert finished.winner_id == first.id
    assert [%{user: winner, wins: 1, played: 1}, %{wins: 0, played: 1}] = Checkers.leaderboard()
    assert winner.id == first.id
  end

  test "reveals only active games to spectators", %{first: first, second: second, third: third} do
    assert {:ok, game} = Checkers.invite(first, second.id)
    assert {:error, :not_found} = Checkers.get_game(third, game.id)
    assert Checkers.list_active_games(third) == []

    assert {:ok, active_game} = Checkers.accept(second, game.id)
    assert {:ok, %{id: game_id}} = Checkers.get_game(third, active_game.id)
    assert game_id == active_game.id
    assert [%Game{id: ^game_id}] = Checkers.list_active_games(third)
    assert [%Game{id: ^game_id}] = Checkers.list_games(first)
  end

  test "removes abandoned pending games but keeps finished games", %{
    first: first,
    second: second,
    third: third
  } do
    assert {:ok, pending_game} = Checkers.invite(first, second.id)
    assert {:ok, finished_game} = Checkers.invite(first, third.id)

    finished_game
    |> Ecto.Changeset.change(status: "finished", winner_id: first.id)
    |> Repo.update!()

    stale_at = DateTime.add(DateTime.utc_now(), -25 * 60 * 60, :second)

    game_ids = [pending_game.id, finished_game.id]

    Repo.update_all(from(game in Game, where: game.id in ^game_ids),
      set: [updated_at: stale_at]
    )

    assert Checkers.cleanup_stale_games() == 1
    assert {:error, :not_found} = Checkers.get_game(first, pending_game.id)
    assert Repo.get(Game, finished_game.id)
  end
end
