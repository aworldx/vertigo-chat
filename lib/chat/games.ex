# Назначение файла: правила лобби, доступа, рейтинга и ходов в Морском бое, Дураке и Балде.
defmodule Chat.Games do
  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Games.{Game, Player}
  alias Chat.Repo

  @topic "games"
  @kinds %{
    "battleship" => %{title: "Морской бой", min: 2, max: 2},
    "durak" => %{title: "Дурак", min: 2, max: 4},
    "balda" => %{title: "Балда", min: 2, max: 4}
  }
  @ranks ~w(6 7 8 9 10 J Q K A)
  @suits ~w(♠ ♥ ♦ ♣)
  @fleet_lengths [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)
  def kinds, do: @kinds
  def kind?(kind), do: Map.has_key?(@kinds, kind)
  def title(kind), do: get_in(@kinds, [kind, :title])
  def max_players(kind), do: get_in(@kinds, [kind, :max])
  def fleet_lengths, do: @fleet_lengths

  def create(%User{} = user, kind) when is_binary(kind) do
    with true <- kind?(kind) do
      Repo.transaction(fn ->
        game =
          %Game{creator_id: user.id}
          |> Game.changeset(%{kind: kind, status: "waiting", state: initial_state(kind, user.id)})
          |> Repo.insert!()

        %Player{game_id: game.id, user_id: user.id}
        |> Player.changeset(%{position: 1, score: 0})
        |> Repo.insert!()

        game
      end)
      |> broadcast_result()
      |> visible_result(user.id)
    else
      false -> {:error, :invalid_kind}
    end
  end

  def join(%User{} = user, game_id) do
    update_locked(game_id, fn game ->
      cond do
        game.status != "waiting" ->
          {:error, :unavailable}

        player?(game, user.id) ->
          {:error, :already_joined}

        length(game.players) >= max_players(game.kind) ->
          {:error, :full}

        true ->
          %Player{game_id: game.id, user_id: user.id}
          |> Player.changeset(%{position: length(game.players) + 1, score: 0})
          |> Repo.insert()
          |> case do
            {:ok, _player} -> {:ok, reload(game.id)}
            error -> error
          end
      end
    end)
    |> visible_result(user.id)
  end

  def start(%User{id: user_id}, game_id) do
    update_locked(game_id, fn game ->
      if game.creator_id == user_id and game.status == "waiting" and
           length(game.players) >= get_in(@kinds, [game.kind, :min]) do
        state = start_state(game.kind, game.players, game.state)
        status = if(game.kind == "battleship", do: "waiting", else: "active")
        game |> Game.changeset(%{status: status, state: state}) |> Repo.update()
      else
        {:error, :cannot_start}
      end
    end)
    |> visible_result(user_id)
  end

  @doc "Places a valid automatic fleet for players who do not want to arrange it manually."
  def place_fleet(%User{} = user, game_id), do: place_fleet(user, game_id, automatic_fleet())

  @doc "Confirms a manually arranged fleet after validating the full classic composition."
  def place_fleet(%User{id: user_id}, game_id, layout) do
    with {:ok, ships} <- normalize_fleet(layout) do
      update_locked(game_id, fn %{kind: "battleship", status: "waiting"} = game ->
        cond do
          not player?(game, user_id) ->
            {:error, :forbidden}

          length(game.players) != max_players(game.kind) or game.state["started"] != true ->
            {:error, :unavailable}

          true ->
            key = user_key(user_id)
            boards = Map.put(game.state["boards"] || %{}, key, board_for(ships))
            fleets = Map.put(game.state["fleets"] || %{}, key, ships)
            ready = Map.put(game.state["ready"] || %{}, key, true)
            active? = Enum.all?(game.players, &ready[user_key(&1.user_id)])

            state =
              Map.merge(game.state, %{
                "boards" => boards,
                "fleets" => fleets,
                "ready" => ready,
                "turn_id" => game.creator_id
              })

            game
            |> Game.changeset(%{state: state, status: if(active?, do: "active", else: "waiting")})
            |> Repo.update()
        end
      end)
      |> visible_result(user_id)
    end
  end

  def place_fleet(_user, _game_id, _layout), do: {:error, :unavailable}

  @doc "Adds one ship to an in-progress fleet layout without persisting it yet."
  def add_fleet_ship(layout, square, size, orientation) when is_list(layout) do
    with {:ok, {row, col}} <- parse_square(square, 10),
         {size, ""} <- Integer.parse(to_string(size)),
         true <- size in @fleet_lengths,
         true <- orientation in ["horizontal", "vertical"],
         true <-
           Enum.count(layout, &(ship_size(&1) == size)) <
             Enum.count(@fleet_lengths, &(&1 == size)),
         cells <- ship_cells({row, col}, size, orientation),
         true <- Enum.all?(cells, &match?({:ok, _}, parse_square(&1, 10))),
         :ok <- ensure_ship_does_not_touch(layout, cells) do
      {:ok, layout ++ [%{"cells" => cells}]}
    else
      _ -> {:error, :invalid_fleet}
    end
  end

  def add_fleet_ship(_layout, _square, _size, _orientation), do: {:error, :invalid_fleet}

  @doc "Removes a ship selected by one of its cells from an in-progress fleet layout."
  def remove_fleet_ship(layout, square) when is_list(layout) and is_binary(square) do
    case Enum.find_index(layout, &(square in ship_cells_from(&1))) do
      nil -> {:error, :ship_not_found}
      index -> {:ok, List.delete_at(layout, index)}
    end
  end

  def remove_fleet_ship(_layout, _square), do: {:error, :ship_not_found}

  def shoot(%User{id: user_id}, game_id, square) do
    update_locked(game_id, fn %{kind: "battleship", status: "active"} = game ->
      opponent_id = other_player_id(game, user_id)
      shots = game.state["shots"] || %{}
      user_shots = shots[user_key(user_id)] || %{}
      opponent_board = game.state["boards"][user_key(opponent_id)] || %{}

      with true <- game.state["turn_id"] == user_id,
           {:ok, _} <- parse_square(square, 10),
           true <- is_nil(user_shots[square]) do
        hit? = opponent_board[square] == "ship"
        user_shots = Map.put(user_shots, square, if(hit?, do: "hit", else: "miss"))
        shots = Map.put(shots, user_key(user_id), user_shots)
        won? = Enum.all?(opponent_board, fn {cell, _} -> user_shots[cell] == "hit" end)

        state =
          Map.put(game.state, "shots", shots)
          |> Map.put("turn_id", if(hit?, do: user_id, else: opponent_id))

        game
        |> Game.changeset(%{
          state: state,
          status: if(won?, do: "finished", else: "active"),
          winner_id: if(won?, do: user_id)
        })
        |> Repo.update()
      else
        _ -> {:error, :invalid_shot}
      end
    end)
    |> visible_result(user_id)
  end

  def shoot(_user, _game_id, _square), do: {:error, :unavailable}

  def play_card(%User{id: user_id}, game_id, card) do
    update_locked(game_id, fn %{kind: "durak", status: "active"} = game ->
      state = game.state
      hand = get_in(state, ["hands", user_key(user_id)]) || []

      with true <- card in hand,
           true <- allowed_card?(state, user_id, card) do
        {state, resolved?} = add_card(state, user_id, card)
        finish_or_update_durak(game, state, resolved?)
      else
        _ -> {:error, :invalid_card}
      end
    end)
    |> visible_result(user_id)
  end

  def play_card(_user, _game_id, _card), do: {:error, :unavailable}

  def take_cards(%User{id: user_id}, game_id) do
    update_locked(game_id, fn %{kind: "durak", status: "active"} = game ->
      state = game.state

      if state["phase"] == "defend" and state["defender_id"] == user_id do
        cards =
          Enum.flat_map(state["table"], fn row -> [row["attack"], row["defense"]] end)
          |> Enum.reject(&is_nil/1)

        hands = Map.update!(state["hands"], user_key(user_id), &(&1 ++ cards))
        state = state |> Map.put("hands", hands) |> reset_round(false)
        finish_or_update_durak(game, state, true)
      else
        {:error, :invalid_take}
      end
    end)
    |> visible_result(user_id)
  end

  def take_cards(_user, _game_id), do: {:error, :unavailable}

  def pass(%User{id: user_id}, game_id) do
    update_locked(game_id, fn %{kind: "durak", status: "active"} = game ->
      state = game.state

      if state["phase"] == "attack" and state["attacker_id"] == user_id and state["table"] != [] and
           Enum.all?(state["table"], & &1["defense"]) do
        finish_or_update_durak(game, reset_round(state, true), true)
      else
        {:error, :invalid_pass}
      end
    end)
    |> visible_result(user_id)
  end

  def pass(_user, _game_id), do: {:error, :unavailable}

  def play_word(%User{id: user_id}, game_id, square, letter, word) do
    update_locked(game_id, fn %{kind: "balda", status: "active"} = game ->
      state = game.state
      letter = normalize_word(letter)
      word = normalize_word(word)
      board = state["board"]

      with true <- state["turn_id"] == user_id,
           {:ok, point} <- parse_square(square, 5),
           true <- is_nil(board[square]),
           true <- String.length(letter) == 1,
           true <- adjacent_to_letter?(board, point),
           true <- String.length(word) >= 3,
           true <- is_nil(state["words"][word]),
           board = Map.put(board, square, letter),
           true <- word_path?(board, String.graphemes(word), square) do
        points = String.length(word)
        player = Enum.find(game.players, &(&1.user_id == user_id))

        {:ok, _player} =
          player |> Player.changeset(%{score: player.score + points}) |> Repo.update()

        state =
          state
          |> Map.put("board", board)
          |> Map.put("words", Map.put(state["words"], word, user_id))
          |> Map.put("skips", 0)

        state = Map.put(state, "turn_id", next_player_id(game.players, user_id))
        finish_or_update_balda(game, state)
      else
        _ -> {:error, :invalid_word}
      end
    end)
    |> visible_result(user_id)
  end

  def play_word(_user, _game_id, _square, _letter, _word), do: {:error, :unavailable}

  def skip(%User{id: user_id}, game_id) do
    update_locked(game_id, fn %{kind: "balda", status: "active"} = game ->
      if game.state["turn_id"] == user_id do
        state =
          game.state
          |> Map.update!("skips", &(&1 + 1))
          |> Map.put("turn_id", next_player_id(game.players, user_id))

        finish_or_update_balda(game, state)
      else
        {:error, :forbidden}
      end
    end)
    |> visible_result(user_id)
  end

  def skip(_user, _game_id), do: {:error, :unavailable}

  def list_games(%User{id: user_id}, kind) do
    from(game in Game,
      join: player in Player,
      on: player.game_id == game.id,
      where:
        player.user_id == ^user_id and game.kind == ^kind and game.status in ["waiting", "active"],
      order_by: [desc: game.updated_at],
      preload: [creator: [], winner: [], players: :user]
    )
    |> Repo.all()
    |> Enum.map(&present_game(&1, user_id))
  end

  def list_active_games(%User{id: user_id}, kind) do
    from(game in Game,
      as: :game,
      where: game.kind == ^kind and game.status == "active",
      where:
        not exists(
          from player in Player,
            where: player.game_id == parent_as(:game).id and player.user_id == ^user_id
        ),
      order_by: [desc: game.updated_at],
      preload: [creator: [], winner: [], players: :user]
    )
    |> Repo.all()
    |> Enum.map(&present_game(&1, user_id))
  end

  def list_waiting_games(%User{id: user_id}, kind) do
    from(game in Game,
      where: game.kind == ^kind and game.status == "waiting",
      order_by: [desc: game.updated_at],
      preload: [creator: [], winner: [], players: :user]
    )
    |> Repo.all()
    |> Enum.reject(&(player?(&1, user_id) or length(&1.players) >= max_players(kind)))
    |> Enum.map(&present_game(&1, user_id))
  end

  def get_game(%User{id: user_id}, game_id) do
    with {id, ""} <- Integer.parse(to_string(game_id)),
         %Game{} = game <- reload(id),
         true <- player?(game, user_id) or game.status in ["active", "finished"] do
      {:ok, present_game(game, user_id)}
    else
      _ -> {:error, :not_found}
    end
  end

  def leaderboard(kind) do
    winners =
      Repo.all(
        from game in Game,
          where: game.kind == ^kind and game.status == "finished",
          select: game.winner_id
      )

    played =
      Repo.all(
        from player in Player,
          join: game in Game,
          on: game.id == player.game_id,
          where: game.kind == ^kind and game.status == "finished",
          select: player.user_id
      )
      |> Enum.frequencies()

    winner_counts = winners |> Enum.reject(&is_nil/1) |> Enum.frequencies()

    Repo.all(
      from user in User,
        where: user.id in ^Map.keys(played) and not user.is_game_guest
    )
    |> Enum.map(
      &%{user: &1, wins: Map.get(winner_counts, &1.id, 0), played: Map.get(played, &1.id, 0)}
    )
    |> Enum.sort_by(fn row -> {-row.wins, row.played, String.downcase(row.user.nickname)} end)
  end

  @doc "Deletes abandoned game boards while keeping completed-game results for leaderboards."
  def cleanup_stale_games(opts \\ []) do
    now = Keyword.get(opts, :now, DateTime.utc_now())
    waiting = delete_stale_games(["waiting"], DateTime.add(now, -24 * 60 * 60, :second))
    active = delete_stale_games(["active"], DateTime.add(now, -7 * 24 * 60 * 60, :second))

    Enum.each(waiting ++ active, fn id ->
      Phoenix.PubSub.broadcast(Chat.PubSub, @topic, {:game_deleted, id})
    end)

    length(waiting) + length(active)
  end

  defp update_locked(game_id, fun) do
    result =
      Repo.transaction(fn ->
        with {id, ""} <- Integer.parse(to_string(game_id)),
             %Game{} = game <-
               Repo.one(from game in Game, where: game.id == ^id, lock: "FOR UPDATE")
               |> Repo.preload(creator: [], winner: [], players: :user),
             {:ok, game} <- fun.(game) do
          game
        else
          {:error, reason} -> Repo.rollback(reason)
          _ -> Repo.rollback(:not_found)
        end
      end)

    broadcast_result(result)
  end

  defp broadcast_result({:ok, %Game{} = game}) do
    game = reload(game.id)
    Phoenix.PubSub.broadcast(Chat.PubSub, @topic, {:game_updated, game.id})
    {:ok, game}
  end

  defp broadcast_result({:error, reason}), do: {:error, reason}

  defp visible_result({:ok, game}, user_id), do: {:ok, present_game(game, user_id)}
  defp visible_result(error, _user_id), do: error

  defp present_game(%Game{kind: "battleship"} = game, user_id) do
    boards = game.state["boards"] || %{}
    fleets = game.state["fleets"] || %{}
    shots = game.state["shots"] || %{}
    own_key = user_key(user_id)
    opponent_id = other_player_id(game, user_id)
    opponent_key = opponent_id && user_key(opponent_id)

    visible_boards =
      if player?(game, user_id), do: Map.take(boards, [own_key]), else: %{}

    visible_fleets = if player?(game, user_id), do: Map.take(fleets, [own_key]), else: %{}

    sunk_cells =
      if player?(game, user_id) do
        %{
          "own" => sunk_cells(fleets[own_key], shots[opponent_key]),
          "target" => sunk_cells(fleets[opponent_key], shots[own_key])
        }
      else
        %{"own" => [], "target" => []}
      end

    %{
      game
      | state:
          game.state
          |> Map.put("boards", visible_boards)
          |> Map.put("fleets", visible_fleets)
          |> Map.put(
            "received_shots",
            if(player?(game, user_id), do: shots[opponent_key] || %{}, else: %{})
          )
          |> Map.put("sunk_cells", sunk_cells)
    }
  end

  defp present_game(%Game{kind: "durak"} = game, user_id) do
    hands = game.state["hands"] || %{}
    visible_hands = if player?(game, user_id), do: Map.take(hands, [user_key(user_id)]), else: %{}
    counts = Map.new(hands, fn {id, cards} -> {id, length(cards)} end)

    %{
      game
      | state: game.state |> Map.put("hands", visible_hands) |> Map.put("hand_counts", counts)
    }
  end

  defp present_game(game, _user_id), do: game

  defp reload(id), do: Repo.get(Game, id) |> Repo.preload(creator: [], winner: [], players: :user)

  defp delete_stale_games(statuses, cutoff) do
    ids =
      Repo.all(
        from game in Game,
          where: game.status in ^statuses and game.updated_at < ^cutoff,
          select: game.id
      )

    if ids != [] do
      Repo.delete_all(from game in Game, where: game.id in ^ids)
    end

    ids
  end

  defp player?(game, user_id), do: Enum.any?(game.players, &(&1.user_id == user_id))
  defp user_key(id), do: Integer.to_string(id)

  defp other_player_id(game, id),
    do: game.players |> Enum.map(& &1.user_id) |> Enum.find(&(&1 != id))

  defp next_player_id(players, id) do
    ids = players |> Enum.sort_by(& &1.position) |> Enum.map(& &1.user_id)
    index = Enum.find_index(ids, &(&1 == id))
    Enum.at(ids, rem(index + 1, length(ids)))
  end

  defp initial_state("battleship", _id),
    do: %{
      "boards" => %{},
      "fleets" => %{},
      "ready" => %{},
      "shots" => %{},
      "started" => false,
      "turn_id" => nil
    }

  defp initial_state("durak", _id), do: %{}
  defp initial_state("balda", _id), do: %{}

  defp start_state("battleship", _players, state), do: Map.put(state, "started", true)

  defp start_state("durak", players, _state) do
    deck = Enum.shuffle(for rank <- @ranks, suit <- @suits, do: "#{rank}-#{suit}")
    {hands, deck} = deal_hands(deck, players)
    [attacker | _] = Enum.sort_by(players, & &1.position)
    defender_id = next_player_id(players, attacker.user_id)

    %{
      "deck" => deck,
      "hands" => hands,
      "trump" => List.last(deck),
      "table" => [],
      "attacker_id" => attacker.user_id,
      "defender_id" => defender_id,
      "turn_id" => attacker.user_id,
      "phase" => "attack"
    }
  end

  defp start_state("balda", players, _state) do
    [first | _] = Enum.sort_by(players, & &1.position)

    board =
      Enum.with_index(String.graphemes("БАЛДА"), fn letter, col -> {"2,#{col}", letter} end)
      |> Map.new()

    %{"board" => board, "words" => %{}, "turn_id" => first.user_id, "skips" => 0}
  end

  defp automatic_fleet do
    ships =
      Enum.map(
        [
          {0, 0, 4},
          {2, 0, 3},
          {4, 0, 3},
          {6, 0, 2},
          {6, 3, 2},
          {8, 0, 2},
          {8, 3, 1},
          {8, 5, 1},
          {8, 7, 1},
          {5, 6, 1}
        ],
        fn {row, col, size} ->
          %{"cells" => for(offset <- 0..(size - 1), do: "#{row},#{col + offset}")}
        end
      )

    transform =
      if :rand.uniform(2) == 1,
        do: fn square -> square end,
        else: fn square ->
          {:ok, {row, col}} = parse_square(square, 10)
          "#{9 - row},#{9 - col}"
        end

    Enum.map(ships, fn %{"cells" => cells} -> %{"cells" => Enum.map(cells, transform)} end)
  end

  defp normalize_fleet(layout) when is_list(layout) do
    with ships when length(ships) == length(@fleet_lengths) <- Enum.map(layout, &normalize_ship/1),
         true <- Enum.all?(ships, &match?({:ok, _}, &1)) do
      ships = Enum.map(ships, fn {:ok, ship} -> ship end)

      if Enum.sort(Enum.map(ships, &length(&1["cells"]))) == Enum.sort(@fleet_lengths) and
           valid_ship_shapes?(ships) and no_ships_touch?(ships) do
        {:ok, ships}
      else
        {:error, :invalid_fleet}
      end
    else
      _ -> {:error, :invalid_fleet}
    end
  end

  defp normalize_fleet(_layout), do: {:error, :invalid_fleet}

  defp normalize_ship(%{"cells" => cells}) when is_list(cells) do
    with true <- Enum.all?(cells, &is_binary/1),
         true <- length(cells) in @fleet_lengths,
         true <- length(cells) == length(Enum.uniq(cells)),
         true <- Enum.all?(cells, &match?({:ok, _}, parse_square(&1, 10))) do
      {:ok, %{"cells" => cells}}
    else
      _ -> {:error, :invalid_ship}
    end
  end

  defp normalize_ship(_ship), do: {:error, :invalid_ship}

  defp valid_ship_shapes?(ships), do: Enum.all?(ships, &valid_ship_shape?/1)

  defp valid_ship_shape?(%{"cells" => [cell]}) do
    match?({:ok, _}, parse_square(cell, 10))
  end

  defp valid_ship_shape?(%{"cells" => cells}) do
    points =
      Enum.map(cells, fn cell ->
        {:ok, point} = parse_square(cell, 10)
        point
      end)

    rows = points |> Enum.map(&elem(&1, 0)) |> Enum.uniq()
    cols = points |> Enum.map(&elem(&1, 1)) |> Enum.uniq()

    cond do
      length(rows) == 1 -> contiguous?(Enum.map(points, &elem(&1, 1)))
      length(cols) == 1 -> contiguous?(Enum.map(points, &elem(&1, 0)))
      true -> false
    end
  end

  defp valid_ship_shape?(_ship), do: false

  defp contiguous?(coordinates) do
    coordinates = Enum.sort(coordinates)
    coordinates == Enum.to_list(hd(coordinates)..List.last(coordinates))
  end

  defp no_ships_touch?(ships) do
    ships
    |> Enum.with_index()
    |> Enum.all?(fn {ship, index} ->
      ships
      |> Enum.drop(index + 1)
      |> Enum.all?(fn other ->
        ships_do_not_touch?(ship_cells_from(ship), ship_cells_from(other))
      end)
    end)
  end

  defp ensure_ship_does_not_touch(layout, cells) do
    if Enum.all?(layout, fn ship -> ships_do_not_touch?(ship_cells_from(ship), cells) end),
      do: :ok,
      else: {:error, :ships_touch}
  end

  defp ships_do_not_touch?(left, right) do
    left_points =
      Enum.map(left, fn square ->
        {:ok, point} = parse_square(square, 10)
        point
      end)

    right_points =
      Enum.map(right, fn square ->
        {:ok, point} = parse_square(square, 10)
        point
      end)

    Enum.all?(left_points, fn {left_row, left_col} ->
      Enum.all?(right_points, fn {right_row, right_col} ->
        abs(left_row - right_row) > 1 or abs(left_col - right_col) > 1
      end)
    end)
  end

  defp ship_cells({row, col}, size, "horizontal"),
    do: for(offset <- 0..(size - 1), do: "#{row},#{col + offset}")

  defp ship_cells({row, col}, size, "vertical"),
    do: for(offset <- 0..(size - 1), do: "#{row + offset},#{col}")

  defp ship_cells_from(%{"cells" => cells}) when is_list(cells), do: cells
  defp ship_cells_from(_ship), do: []
  defp ship_size(ship), do: length(ship_cells_from(ship))

  defp board_for(ships) do
    ships
    |> Enum.flat_map(&ship_cells_from/1)
    |> Map.new(&{&1, "ship"})
  end

  defp sunk_cells(ships, shots) when is_list(ships) and is_map(shots) do
    ships
    |> Enum.flat_map(fn ship ->
      cells = ship_cells_from(ship)
      if cells != [] and Enum.all?(cells, &(shots[&1] == "hit")), do: cells, else: []
    end)
  end

  defp sunk_cells(_ships, _shots), do: []

  defp parse_square(square, size) do
    case String.split(to_string(square), ",") |> Enum.map(&Integer.parse/1) do
      [{row, ""}, {col, ""}] when row >= 0 and row < size and col >= 0 and col < size ->
        {:ok, {row, col}}

      _ ->
        :error
    end
  end

  defp deal_hands(deck, players) do
    Enum.reduce(players, {%{}, deck}, fn player, {hands, rest} ->
      {hand, rest} = Enum.split(rest, 6)
      {Map.put(hands, user_key(player.user_id), hand), rest}
    end)
  end

  defp allowed_card?(state, user_id, card) do
    cond do
      state["phase"] == "attack" and state["attacker_id"] == user_id ->
        state["table"] == [] or card_rank_in_table?(state["table"], card)

      state["phase"] == "defend" and state["defender_id"] == user_id ->
        case Enum.find(state["table"], &is_nil(&1["defense"])) do
          nil -> false
          row -> beats?(card, row["attack"], state["trump"])
        end

      true ->
        false
    end
  end

  defp add_card(state, user_id, card) do
    hands = Map.update!(state["hands"], user_key(user_id), &List.delete(&1, card))
    state = Map.put(state, "hands", hands)

    if state["phase"] == "attack" do
      {state
       |> Map.update!("table", &(&1 ++ [%{"attack" => card, "defense" => nil}]))
       |> Map.put("phase", "defend")
       |> Map.put("turn_id", state["defender_id"]), false}
    else
      table =
        List.update_at(
          state["table"],
          Enum.find_index(state["table"], &is_nil(&1["defense"])),
          &Map.put(&1, "defense", card)
        )

      {Map.put(state, "table", table)
       |> Map.put("phase", "attack")
       |> Map.put("turn_id", state["attacker_id"]), true}
    end
  end

  defp card_rank_in_table?(table, card),
    do:
      card_rank(card) in Enum.flat_map(table, fn row ->
        [card_rank(row["attack"]), if(row["defense"], do: card_rank(row["defense"]))]
      end)

  defp beats?(card, attack, trump),
    do:
      (card_suit(card) == card_suit(attack) and rank_value(card) > rank_value(attack)) or
        (card_suit(card) == card_suit(trump) and card_suit(attack) != card_suit(trump))

  defp card_rank(card), do: card |> String.split("-", parts: 2) |> hd()
  defp card_suit(card), do: card |> String.split("-", parts: 2) |> List.last()
  defp rank_value(card), do: Enum.find_index(@ranks, &(&1 == card_rank(card)))

  defp reset_round(state, defended?) do
    players = Map.keys(state["hands"]) |> Enum.map(&String.to_integer/1) |> Enum.sort()
    attacker = if(defended?, do: state["defender_id"], else: state["attacker_id"])

    defender =
      Enum.at(players, rem(Enum.find_index(players, &(&1 == attacker)) + 1, length(players)))

    state
    |> Map.put("table", [])
    |> Map.put("attacker_id", attacker)
    |> Map.put("defender_id", defender)
    |> Map.put("turn_id", attacker)
    |> Map.put("phase", "attack")
    |> draw_cards()
  end

  defp draw_cards(state) do
    Enum.reduce(Map.keys(state["hands"]), state, fn id, acc ->
      hand = acc["hands"][id]
      {draw, deck} = Enum.split(acc["deck"], max(6 - length(hand), 0))
      acc |> Map.put("deck", deck) |> put_in(["hands", id], hand ++ draw)
    end)
  end

  defp finish_or_update_durak(game, state, _resolved?) do
    empty_id =
      if state["deck"] == [] do
        Enum.find_value(state["hands"], fn {id, cards} ->
          if cards == [], do: String.to_integer(id)
        end)
      end

    game
    |> Game.changeset(%{
      state: state,
      status: if(empty_id, do: "finished", else: "active"),
      winner_id: empty_id
    })
    |> Repo.update()
  end

  defp normalize_word(value) do
    value = value |> to_string() |> String.upcase() |> String.trim()
    if Regex.match?(~r/\A[А-ЯЁ]+\z/u, value), do: value, else: ""
  end

  defp adjacent_to_letter?(board, {row, col}),
    do:
      Enum.any?([{1, 0}, {-1, 0}, {0, 1}, {0, -1}], fn {dr, dc} ->
        board["#{row + dr},#{col + dc}"]
      end)

  defp word_path?(board, letters, required),
    do:
      Enum.any?(board, fn {square, letter} ->
        letter == hd(letters) and
          path_from?(board, square, letters, MapSet.new(), required, false)
      end)

  defp path_from?(_board, _square, [], _seen, _required, used?), do: used?

  defp path_from?(board, square, [letter | rest], seen, required, used?) do
    with false <- MapSet.member?(seen, square),
         ^letter <- board[square],
         {:ok, {row, col}} <- parse_square(square, 5) do
      seen = MapSet.put(seen, square)
      used? = used? or square == required

      if rest == [],
        do: used?,
        else:
          Enum.any?([{1, 0}, {-1, 0}, {0, 1}, {0, -1}], fn {dr, dc} ->
            path_from?(board, "#{row + dr},#{col + dc}", rest, seen, required, used?)
          end)
    else
      _ -> false
    end
  end

  defp finish_or_update_balda(game, state) do
    finished? = map_size(state["board"]) == 25 or state["skips"] >= length(game.players)

    winner_id =
      if finished? do
        game.players
        |> Enum.max_by(& &1.score, fn -> nil end)
        |> then(&(&1 && &1.user_id))
      end

    game
    |> Game.changeset(%{
      state: state,
      status: if(finished?, do: "finished", else: "active"),
      winner_id: winner_id
    })
    |> Repo.update()
  end
end
