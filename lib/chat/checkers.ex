# Назначение файла: бизнес-правила приглашений, ходов и рейтинга игры в шашки.
defmodule Chat.Checkers do
  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Checkers.Game
  alias Chat.Repo

  @topic "checkers"
  @open_statuses ~w(pending active)

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)

  def list_opponents(%User{id: user_id}) do
    Repo.all(from user in User, where: user.id != ^user_id, order_by: [asc: user.nickname])
  end

  def list_games(%User{id: user_id}) do
    from(game in Game,
      where: game.inviter_id == ^user_id or game.opponent_id == ^user_id,
      where: game.status in ^@open_statuses,
      order_by: [desc: game.updated_at],
      preload: [:inviter, :opponent, :white, :winner]
    )
    |> Repo.all()
  end

  def list_active_games(%User{id: user_id}) do
    from(game in Game,
      where: game.status == "active",
      where: game.inviter_id != ^user_id and game.opponent_id != ^user_id,
      order_by: [desc: game.updated_at],
      preload: [:inviter, :opponent, :white, :winner]
    )
    |> Repo.all()
  end

  def get_game(%User{id: user_id}, id) do
    with {id, ""} <- Integer.parse(to_string(id)),
         %Game{} = game <-
           Repo.get(Game, id) |> Repo.preload([:inviter, :opponent, :white, :winner]),
         true <- participant?(game, user_id) or game.status == "active" do
      {:ok, game}
    else
      _reason -> {:error, :not_found}
    end
  end

  def invite(%User{} = inviter, opponent_id) do
    with {opponent_id, ""} <- Integer.parse(to_string(opponent_id)),
         %User{} = opponent <- Repo.get(User, opponent_id),
         true <- opponent.id != inviter.id,
         false <- open_game?(inviter.id, opponent.id) do
      %Game{inviter_id: inviter.id, opponent_id: opponent.id}
      |> Game.invitation_changeset(%{board: initial_board(), status: "pending", turn: "white"})
      |> Repo.insert()
      |> broadcast_result()
    else
      true -> {:error, :already_open}
      _reason -> {:error, :invalid_opponent}
    end
  end

  def accept(%User{id: user_id}, game_id) do
    update_locked(game_id, fn game ->
      if game.status == "pending" and game.opponent_id == user_id do
        game
        |> Ecto.Changeset.change(status: "active", white_id: game.inviter_id)
        |> Repo.update()
      else
        {:error, :forbidden}
      end
    end)
  end

  def decline(%User{id: user_id}, game_id) do
    update_locked(game_id, fn game ->
      if game.status == "pending" and game.opponent_id == user_id do
        game |> Ecto.Changeset.change(status: "declined") |> Repo.update()
      else
        {:error, :forbidden}
      end
    end)
  end

  def move(%User{id: user_id}, game_id, from, to) do
    update_locked(game_id, &make_move(&1, user_id, from, to))
  end

  def leaderboard do
    wins =
      Repo.all(
        from game in Game,
          where: game.status == "finished" and not is_nil(game.winner_id),
          group_by: game.winner_id,
          select: {game.winner_id, count(game.id)}
      )
      |> Map.new()

    played =
      Repo.all(
        from game in Game,
          where: game.status == "finished",
          select: {game.inviter_id, game.opponent_id}
      )
      |> Enum.reduce(%{}, fn {a, b}, acc ->
        acc |> Map.update(a, 1, &(&1 + 1)) |> Map.update(b, 1, &(&1 + 1))
      end)

    ids = Map.keys(played)

    Repo.all(from user in User, where: user.id in ^ids)
    |> Enum.map(&%{user: &1, wins: Map.get(wins, &1.id, 0), played: played[&1.id]})
    |> Enum.sort_by(fn row -> {-row.wins, row.played, String.downcase(row.user.nickname)} end)
  end

  def initial_board do
    for row <- 0..7,
        col <- 0..7,
        rem(row + col, 2) == 1,
        row in [0, 1, 2, 5, 6, 7],
        into: %{} do
      {key(row, col), if(row < 3, do: "b", else: "w")}
    end
  end

  defp make_move(%Game{status: "active"} = game, user_id, from, to) do
    color = player_color(game, user_id)

    with color when color in ~w(white black) <- color,
         true <- game.turn == color,
         {:ok, {from_row, from_col}} <- parse_square(from),
         {:ok, {to_row, to_col}} <- parse_square(to),
         piece when not is_nil(piece) <- game.board[from],
         true <- piece_color(piece) == color,
         true <- is_nil(game.board[to]),
         true <- is_nil(game.forced_from) or game.forced_from == from,
         {:ok, captured} <-
           validate_step(game.board, piece, {from_row, from_col}, {to_row, to_col}) do
      board =
        game.board
        |> Map.delete(from)
        |> maybe_delete(captured)
        |> Map.put(to, crown(piece, to_row))

      continue? = not is_nil(captured) and captures_from?(board, to)
      next_turn = if continue?, do: color, else: other_color(color)
      winner_id = winner_id(game, board, next_turn)

      game
      |> Ecto.Changeset.change(
        board: board,
        turn: next_turn,
        forced_from: if(continue?, do: to),
        status: if(winner_id, do: "finished", else: "active"),
        winner_id: winner_id
      )
      |> Repo.update()
    else
      _reason -> {:error, :invalid_move}
    end
  end

  defp make_move(_game, _user_id, _from, _to), do: {:error, :invalid_move}

  defp validate_step(board, piece, {fr, fc}, {tr, tc}) do
    dr = tr - fr
    dc = tc - fc

    capture_required? =
      Enum.any?(board, fn {square, own_piece} ->
        piece_color(own_piece) == piece_color(piece) and captures_from?(board, square)
      end)

    cond do
      abs(dr) == 2 and abs(dc) == 2 ->
        middle = key(div(fr + tr, 2), div(fc + tc, 2))

        if board[middle] && piece_color(board[middle]) != piece_color(piece),
          do: {:ok, middle},
          else: :error

      not capture_required? and abs(dr) == 1 and abs(dc) == 1 and forward?(piece, dr) ->
        {:ok, nil}

      true ->
        :error
    end
  end

  defp captures_from?(board, square) do
    with {:ok, {row, col}} <- parse_square(square),
         piece when not is_nil(piece) <- board[square] do
      Enum.any?([{2, 2}, {2, -2}, {-2, 2}, {-2, -2}], fn {dr, dc} ->
        target = {row + dr, col + dc}
        middle = key(row + div(dr, 2), col + div(dc, 2))

        (on_board?(target) and is_nil(board[key(target)]) and board[middle]) &&
          piece_color(board[middle]) != piece_color(piece)
      end)
    else
      _reason -> false
    end
  end

  defp winner_id(game, board, next_turn) do
    if Enum.any?(board, fn {_square, piece} -> piece_color(piece) == next_turn end) do
      nil
    else
      if next_turn == "white", do: black_id(game), else: game.white_id
    end
  end

  defp update_locked(game_id, fun) do
    result =
      Repo.transaction(fn ->
        with {id, ""} <- Integer.parse(to_string(game_id)),
             %Game{} = game <-
               Repo.one(from game in Game, where: game.id == ^id, lock: "FOR UPDATE"),
             {:ok, updated} <- fun.(game) do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
          _reason -> Repo.rollback(:not_found)
        end
      end)

    case result do
      {:ok, game} -> broadcast_result({:ok, game})
      {:error, reason} -> {:error, reason}
    end
  end

  defp broadcast_result({:ok, game}) do
    Phoenix.PubSub.broadcast(Chat.PubSub, @topic, {:game_updated, game.id})
    {:ok, Repo.preload(game, [:inviter, :opponent, :white, :winner], force: true)}
  end

  defp broadcast_result(error), do: error

  defp open_game?(a, b) do
    Repo.exists?(
      from game in Game,
        where: game.status in ^@open_statuses,
        where:
          (game.inviter_id == ^a and game.opponent_id == ^b) or
            (game.inviter_id == ^b and game.opponent_id == ^a)
    )
  end

  defp participant?(game, id), do: game.inviter_id == id or game.opponent_id == id

  defp player_color(game, id),
    do: if(game.white_id == id, do: "white", else: if(participant?(game, id), do: "black"))

  defp black_id(game),
    do: if(game.white_id == game.inviter_id, do: game.opponent_id, else: game.inviter_id)

  defp other_color("white"), do: "black"
  defp other_color("black"), do: "white"
  defp piece_color(piece) when piece in ~w(w W), do: "white"
  defp piece_color(_piece), do: "black"
  defp forward?(piece, dr) when piece in ~w(W B), do: abs(dr) == 1
  defp forward?("w", dr), do: dr == -1
  defp forward?("b", dr), do: dr == 1
  defp crown("w", 0), do: "W"
  defp crown("b", 7), do: "B"
  defp crown(piece, _row), do: piece
  defp maybe_delete(board, nil), do: board
  defp maybe_delete(board, square), do: Map.delete(board, square)
  defp key({row, col}), do: key(row, col)
  defp key(row, col), do: "#{row},#{col}"
  defp on_board?({row, col}), do: row in 0..7 and col in 0..7

  defp parse_square(square) when is_binary(square) do
    case String.split(square, ",") do
      [row, col] ->
        with {row, ""} <- Integer.parse(row),
             {col, ""} <- Integer.parse(col),
             true <- on_board?({row, col}) do
          {:ok, {row, col}}
        else
          _reason -> :error
        end

      _other ->
        :error
    end
  end
end
