# Назначение файла: LiveView витрины, лобби и игровых столов новых игр.
defmodule ChatWeb.GamesLive do
  use ChatWeb, :live_view

  alias Chat.Accounts
  alias Chat.Games
  alias ChatWeb.UserAuth

  @ship_types %{
    1 => {"boat", "Лодка"},
    2 => {"cutter", "Катер"},
    3 => {"cruiser", "Крейсер"},
    4 => {"battleship", "Линкор"}
  }

  @impl true
  def mount(params, _session, socket) do
    if connected?(socket), do: Games.subscribe()
    kind = params["kind"]

    {:ok,
     socket
     |> assign(:kind, kind)
     |> assign(:page_title, if(kind, do: Games.title(kind), else: "Игры"))
     |> assign(:meta_description, games_description(kind))
     |> assign(:canonical_path, games_path(kind))
     |> assign(:current_user, nil)
     |> assign(:auth_checked?, false)
     |> assign(:games, [])
     |> assign(:waiting_games, [])
     |> assign(:active_games, [])
     |> assign(:game, nil)
     |> assign(:fleet_draft, [])
     |> assign(:fleet_size, 4)
     |> assign(:fleet_orientation, "horizontal")
     |> assign(:selected_square, nil)
     |> assign(:word_form, to_form(%{"letter" => "", "word" => ""}, as: :word))
     |> assign(:leaderboard, if(Games.kind?(kind), do: Games.leaderboard(kind), else: []))}
  end

  @impl true
  def handle_event("authenticate_games", params, socket) do
    case game_player(params) do
      {:ok, user} ->
        {:noreply,
         socket |> assign(:current_user, user) |> assign(:auth_checked?, true) |> refresh()}

      {:error, _reason} ->
        {:noreply, socket |> assign(:current_user, nil) |> assign(:auth_checked?, true)}
    end
  end

  def handle_event("create", _params, socket) do
    with %{} = user <- socket.assigns.current_user,
         {:ok, game} <- Games.create(user, socket.assigns.kind) do
      {:noreply,
       socket
       |> assign(:game, game)
       |> refresh()
       |> put_flash(:info, "Стол создан. Пригласи чатлан присоединиться.")}
    else
      _ -> {:noreply, put_flash(socket, :error, "Не удалось создать игру.")}
    end
  end

  def handle_event("join", %{"id" => id}, socket),
    do: game_action(socket, &Games.join(&1, id), "Ты за игровым столом.")

  def handle_event("start", %{"id" => id}, socket),
    do: game_action(socket, &Games.start(&1, id), "Партия началась.")

  def handle_event("fleet", %{"id" => id}, socket),
    do: game_action(socket, &Games.place_fleet(&1, id), "Флот расставлен.")

  def handle_event("select_fleet_size", %{"size" => size}, socket) do
    with {size, ""} <- Integer.parse(size),
         true <- size in Games.fleet_lengths() do
      {:noreply, assign(socket, :fleet_size, size)}
    else
      _ -> {:noreply, socket}
    end
  end

  def handle_event("toggle_fleet_orientation", _params, socket) do
    orientation =
      if socket.assigns.fleet_orientation == "horizontal", do: "vertical", else: "horizontal"

    {:noreply, assign(socket, :fleet_orientation, orientation)}
  end

  def handle_event("place_fleet_ship", %{"square" => square}, socket) do
    case Games.add_fleet_ship(
           socket.assigns.fleet_draft,
           square,
           socket.assigns.fleet_size,
           socket.assigns.fleet_orientation
         ) do
      {:ok, fleet_draft} ->
        {:noreply, assign(socket, :fleet_draft, fleet_draft)}

      {:error, _reason} ->
        {:noreply, put_flash(socket, :error, "Сюда этот корабль не поставить.")}
    end
  end

  def handle_event("remove_fleet_ship", %{"square" => square}, socket) do
    case Games.remove_fleet_ship(socket.assigns.fleet_draft, square) do
      {:ok, fleet_draft} -> {:noreply, assign(socket, :fleet_draft, fleet_draft)}
      {:error, _reason} -> {:noreply, socket}
    end
  end

  def handle_event("confirm_fleet", _params, socket) do
    with %{} = user <- socket.assigns.current_user,
         %{id: game_id} <- socket.assigns.game,
         {:ok, game} <- Games.place_fleet(user, game_id, socket.assigns.fleet_draft) do
      {:noreply,
       socket
       |> assign(:game, game)
       |> assign(:fleet_draft, [])
       |> refresh()
       |> put_flash(:info, "Флот расставлен.")}
    else
      _ -> {:noreply, put_flash(socket, :error, "Флот расставлен не по правилам.")}
    end
  end

  def handle_event("take", _params, socket),
    do: current_game_action(socket, &Games.take_cards(&1, socket.assigns.game.id))

  def handle_event("pass", _params, socket),
    do: current_game_action(socket, &Games.pass(&1, socket.assigns.game.id))

  def handle_event("skip", _params, socket),
    do: current_game_action(socket, &Games.skip(&1, socket.assigns.game.id))

  def handle_event("open", %{"id" => id}, socket) do
    case Games.get_game(socket.assigns.current_user, id) do
      {:ok, game} ->
        {:noreply,
         socket
         |> assign(:game, game)
         |> assign(:fleet_draft, [])
         |> assign(:selected_square, nil)}

      _ ->
        {:noreply, put_flash(socket, :error, "Партия недоступна.")}
    end
  end

  def handle_event("shot", %{"square" => square}, socket),
    do: current_game_action(socket, &Games.shoot(&1, socket.assigns.game.id, square))

  def handle_event("card", %{"card" => card}, socket),
    do: current_game_action(socket, &Games.play_card(&1, socket.assigns.game.id, card))

  def handle_event("balda_square", %{"square" => square}, socket),
    do: {:noreply, assign(socket, :selected_square, square)}

  def handle_event("word", %{"word" => attrs}, socket) do
    case Games.play_word(
           socket.assigns.current_user,
           socket.assigns.game.id,
           socket.assigns.selected_square,
           attrs["letter"],
           attrs["word"]
         ) do
      {:ok, game} ->
        {:noreply,
         socket
         |> assign(:game, game)
         |> assign(:selected_square, nil)
         |> assign(:word_form, to_form(%{"letter" => "", "word" => ""}, as: :word))
         |> refresh()}

      _ ->
        {:noreply,
         put_flash(socket, :error, "Слово не складывается на поле или уже было названо.")}
    end
  end

  @impl true
  def handle_info({:game_updated, _game_id}, %{assigns: %{current_user: nil}} = socket),
    do: {:noreply, socket}

  def handle_info({:game_updated, game_id}, socket) do
    socket = refresh(socket)

    if socket.assigns.game && socket.assigns.game.id == game_id do
      case Games.get_game(socket.assigns.current_user, game_id) do
        {:ok, game} -> {:noreply, assign(socket, :game, game)}
        _ -> {:noreply, assign(socket, :game, nil)}
      end
    else
      {:noreply, socket}
    end
  end

  def handle_info({:game_deleted, _game_id}, %{assigns: %{current_user: nil}} = socket),
    do: {:noreply, socket}

  def handle_info({:game_deleted, game_id}, socket) do
    socket = refresh(socket)

    socket =
      if socket.assigns.game && socket.assigns.game.id == game_id do
        assign(socket, :game, nil)
      else
        socket
      end

    {:noreply, socket}
  end

  def kinds, do: Games.kinds()
  def title(kind), do: Games.title(kind)

  def squares(size),
    do: for(row <- 0..(size - 1), col <- 0..(size - 1), do: {row, col, "#{row},#{col}"})

  def player?(game, user), do: user && Enum.any?(game.players, &(&1.user_id == user.id))

  def can_start?(game, user),
    do:
      (user && game.creator_id == user.id) and game.status == "waiting" and
        length(game.players) >= 2

  def fleet_ready?(game, user),
    do: get_in(game.state, ["ready", Integer.to_string(user.id)]) == true

  def battleship_setup_open?(game),
    do: game.status == "waiting" and game.state["started"] == true

  def fleet_draft_cells(draft),
    do: draft |> Enum.flat_map(&Map.get(&1, "cells", [])) |> MapSet.new()

  def fleet_remaining(draft, size),
    do:
      Enum.count(Games.fleet_lengths(), &(&1 == size)) -
        Enum.count(draft, &(fleet_size(&1) == size))

  def fleet_complete?(draft),
    do: Enum.sort(Enum.map(draft, &fleet_size/1)) == Enum.sort(Games.fleet_lengths())

  def ship_type_label(size), do: @ship_types |> Map.get(size, {"ship", "Корабль"}) |> elem(1)

  def ship_model(fleet, square) when is_list(fleet) and is_binary(square) do
    Enum.find_value(fleet, fn
      %{"cells" => cells} when is_list(cells) -> ship_model_for(cells, square)
      _ship -> nil
    end)
  end

  def ship_model(_fleet, _square), do: nil

  attr :model, :map, required: true

  def ship_model(assigns) do
    ~H"""
    <span
      class={[
        "ship-token",
        "ship-token--#{@model.type}",
        "ship-token--length-#{@model.length}",
        "ship-token--#{@model.orientation}"
      ]}
      aria-label={@model.label}
    ></span>
    """
  end

  def current_turn?(game, user), do: user && game.state["turn_id"] == user.id

  def can_play_durak_card?(game, user) do
    user && game.status == "active" &&
      cond do
        game.state["defender_id"] == user.id ->
          game.state["phase"] == "defend" and
            Enum.any?(game.state["table"] || [], &is_nil(&1["defense"]))

        (game.state["table"] || []) == [] ->
          game.state["phase"] == "attack" and game.state["attacker_id"] == user.id

        true ->
          length(game.state["table"] || []) < min(6, game.state["defender_hand_size"] || 6)
      end
  end

  def can_take_durak?(game, user),
    do:
      user && game.status == "active" && game.state["phase"] == "defend" &&
        game.state["defender_id"] == user.id

  def can_pass_durak?(game, user),
    do:
      user && game.status == "active" && game.state["phase"] == "attack" &&
        game.state["attacker_id"] == user.id && game.state["table"] != [] &&
        Enum.all?(game.state["table"], & &1["defense"])

  def durak_turn_message(game, user) do
    cond do
      game.status != "active" ->
        "Партия завершена"

      game.state["defender_id"] == user and game.state["phase"] == "defend" ->
        "Ты отбиваешься — побей карту или возьми."

      game.state["phase"] == "defend" ->
        "#{player_name(game, game.state["defender_id"])} отбивается — можно подкинуть карту того же ранга."

      game.state["attacker_id"] == user ->
        "Твоя атака — положи карту или объяви «Бито»."

      true ->
        "Атакует #{player_name(game, game.state["attacker_id"])}."
    end
  end

  def user_key(user), do: Integer.to_string(user.id)

  def player_name(game, id),
    do: game.players |> Enum.find(&(&1.user_id == id)) |> then(&Accounts.game_nickname(&1.user))

  def display_name(user), do: Accounts.game_nickname(user)

  def own_board(game, user), do: get_in(game.state, ["boards", user_key(user)]) || %{}
  def own_shots(game, user), do: get_in(game.state, ["shots", user_key(user)]) || %{}
  def received_shots(game), do: game.state["received_shots"] || %{}
  def sunk_cells(game, perspective), do: get_in(game.state, ["sunk_cells", perspective]) || []
  def hand(game, user), do: get_in(game.state, ["hands", user_key(user)]) || []
  def card_rank(card), do: card |> String.split("-", parts: 2) |> hd()
  def card_suit(card), do: card |> String.split("-", parts: 2) |> List.last()

  attr :card, :string, required: true

  def durak_card(assigns) do
    assigns =
      assigns
      |> assign(:asset_name, card_asset_name(assigns.card))
      |> assign(:label, "#{card_rank(assigns.card)}#{card_suit(assigns.card)}")

    ~H"""
    <img class="playing-card__image" src={"/images/cards/#{@asset_name}.png"} alt={@label} />
    """
  end

  defp card_asset_name(card) do
    rank =
      %{"J" => "jack", "Q" => "queen", "K" => "king", "A" => "1"}[card_rank(card)] ||
        card_rank(card)

    suit = %{"♣" => "club", "♦" => "diamond", "♥" => "heart", "♠" => "spade"}[card_suit(card)]
    "#{suit}_#{rank}"
  end

  def balda_board(game), do: game.state["board"] || %{}
  def score(game, id), do: game.players |> Enum.find(&(&1.user_id == id)) |> then(& &1.score)

  defp current_game_action(socket, fun) do
    with %{} = user <- socket.assigns.current_user,
         %{id: _id} <- socket.assigns.game,
         {:ok, game} <- fun.(user) do
      {:noreply, socket |> assign(:game, game) |> refresh()}
    else
      _ -> {:noreply, put_flash(socket, :error, "Этот ход сейчас недоступен.")}
    end
  end

  defp fleet_size(%{"cells" => cells}) when is_list(cells), do: length(cells)
  defp fleet_size(_ship), do: 0

  defp ship_model_for(cells, square) do
    points = Enum.map(cells, &ship_point/1)

    if Enum.any?(points, &is_nil/1) do
      nil
    else
      {anchor_row, anchor_col} = Enum.min_by(points, fn {row, col} -> {row, col} end)

      if square == "#{anchor_row},#{anchor_col}" do
        length = length(cells)
        {type, label} = Map.get(@ship_types, length, {"ship", "Корабль"})

        orientation =
          if Enum.all?(points, &(elem(&1, 0) == anchor_row)), do: "horizontal", else: "vertical"

        %{length: length, type: type, label: label, orientation: orientation}
      end
    end
  end

  defp ship_point(cell) when is_binary(cell) do
    case String.split(cell, ",", parts: 2) do
      [row, col] ->
        with {row, ""} <- Integer.parse(row),
             {col, ""} <- Integer.parse(col) do
          {row, col}
        else
          _ -> nil
        end

      _ ->
        nil
    end
  end

  defp ship_point(_cell), do: nil

  defp games_path(kind) when is_binary(kind) and kind != "", do: ~p"/games/#{kind}"
  defp games_path(_kind), do: ~p"/games"

  defp games_description("battleship"),
    do: "Морской бой в Vertigo: создавай стол и играй с чатланами."

  defp games_description("durak"),
    do: "Игра «Дурак» в Vertigo: собирайся за игровым столом с чатланами."

  defp games_description("balda"),
    do: "Игра «Балда» в Vertigo: составляй слова и соревнуйся с чатланами."

  defp games_description(_kind), do: "Игры в Vertigo: собирайся с чатланами за игровыми столами."

  defp game_player(%{"token" => token}) do
    UserAuth.verify(token)
  end

  defp game_player(%{"guest_nickname" => nickname, "guest_identity_token" => token}) do
    with {:ok, guest_identity_id} <- UserAuth.verify_guest_identity(token, nickname) do
      Accounts.ensure_game_guest(nickname, guest_identity_id)
    end
  end

  defp game_player(_params), do: {:error, :invalid_player}

  defp game_action(socket, fun, message) do
    with %{} = user <- socket.assigns.current_user,
         {:ok, game} <- fun.(user) do
      {:noreply, socket |> assign(:game, game) |> refresh() |> put_flash(:info, message)}
    else
      _ -> {:noreply, put_flash(socket, :error, "Действие недоступно.")}
    end
  end

  defp refresh(%{assigns: %{current_user: nil}} = socket), do: socket
  defp refresh(%{assigns: %{kind: kind}} = socket) when not is_binary(kind), do: socket

  defp refresh(socket) do
    user = socket.assigns.current_user

    socket
    |> assign(:games, Games.list_games(user, socket.assigns.kind))
    |> assign(:waiting_games, Games.list_waiting_games(user, socket.assigns.kind))
    |> assign(:active_games, Games.list_active_games(user, socket.assigns.kind))
    |> assign(:leaderboard, Games.leaderboard(socket.assigns.kind))
  end
end
