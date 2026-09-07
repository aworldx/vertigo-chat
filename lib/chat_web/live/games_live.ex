# Назначение файла: LiveView витрины, лобби и игровых столов новых игр.
defmodule ChatWeb.GamesLive do
  use ChatWeb, :live_view

  alias Chat.Accounts
  alias Chat.Games
  alias ChatWeb.UserAuth

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

  def handle_event("take", _params, socket),
    do: current_game_action(socket, &Games.take_cards(&1, socket.assigns.game.id))

  def handle_event("pass", _params, socket),
    do: current_game_action(socket, &Games.pass(&1, socket.assigns.game.id))

  def handle_event("skip", _params, socket),
    do: current_game_action(socket, &Games.skip(&1, socket.assigns.game.id))

  def handle_event("open", %{"id" => id}, socket) do
    case Games.get_game(socket.assigns.current_user, id) do
      {:ok, game} -> {:noreply, socket |> assign(:game, game) |> assign(:selected_square, nil)}
      _ -> {:noreply, put_flash(socket, :error, "Партия недоступна.")}
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

  def current_turn?(game, user), do: user && game.state["turn_id"] == user.id
  def user_key(user), do: Integer.to_string(user.id)

  def player_name(game, id),
    do: game.players |> Enum.find(&(&1.user_id == id)) |> then(&Accounts.game_nickname(&1.user))

  def display_name(user), do: Accounts.game_nickname(user)

  def own_board(game, user), do: get_in(game.state, ["boards", user_key(user)]) || %{}
  def own_shots(game, user), do: get_in(game.state, ["shots", user_key(user)]) || %{}
  def hand(game, user), do: get_in(game.state, ["hands", user_key(user)]) || []
  def card_rank(card), do: card |> String.split("-", parts: 2) |> hd()
  def card_suit(card), do: card |> String.split("-", parts: 2) |> List.last()
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
