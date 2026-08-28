# Назначение файла: LiveView лобби, игровой доски и таблицы победителей в шашки.
defmodule ChatWeb.CheckersLive do
  use ChatWeb, :live_view

  alias Chat.Checkers
  alias ChatWeb.UserAuth

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket), do: Checkers.subscribe()

    {:ok,
     socket
     |> assign(:page_title, "Шашки")
     |> assign(:current_user, nil)
     |> assign(:auth_checked?, false)
     |> assign(:opponents, [])
     |> assign(:games, [])
     |> assign(:active_games, [])
     |> assign(:game, nil)
     |> assign(:selected_square, nil)
     |> assign(:invite_form, to_form(%{"opponent_id" => ""}, as: :invite))
     |> assign(:leaderboard, Checkers.leaderboard())}
  end

  @impl true
  def handle_event("authenticate_checkers", %{"token" => token}, socket) do
    case UserAuth.verify(token) do
      {:ok, user} ->
        {:noreply,
         socket |> assign(:current_user, user) |> assign(:auth_checked?, true) |> refresh()}

      {:error, :invalid_token} ->
        {:noreply, socket |> assign(:current_user, nil) |> assign(:auth_checked?, true)}
    end
  end

  def handle_event("authenticate_checkers", _params, socket) do
    {:noreply, socket |> assign(:current_user, nil) |> assign(:auth_checked?, true)}
  end

  def handle_event("invite", %{"invite" => %{"opponent_id" => opponent_id}}, socket) do
    case Checkers.invite(socket.assigns.current_user, opponent_id) do
      {:ok, game} ->
        {:noreply,
         socket
         |> assign(:game, game)
         |> assign(:invite_form, to_form(%{"opponent_id" => ""}, as: :invite))
         |> refresh()
         |> put_flash(:info, "Приглашение отправлено.")}

      {:error, :already_open} ->
        {:noreply, put_flash(socket, :error, "У вас уже есть открытая партия с этим чатланином.")}

      _error ->
        {:noreply, put_flash(socket, :error, "Не удалось отправить приглашение.")}
    end
  end

  def handle_event("open_game", %{"id" => id}, socket) do
    case Checkers.get_game(socket.assigns.current_user, id) do
      {:ok, game} -> {:noreply, socket |> assign(:game, game) |> assign(:selected_square, nil)}
      _error -> {:noreply, put_flash(socket, :error, "Партия не найдена.")}
    end
  end

  def handle_event("accept", %{"id" => id}, socket),
    do: game_action(socket, &Checkers.accept(&1, id), "Игра началась.")

  def handle_event("decline", %{"id" => id}, socket),
    do: game_action(socket, &Checkers.decline(&1, id), "Приглашение отклонено.")

  def handle_event(
        "square",
        %{"square" => square},
        %{assigns: %{game: %{status: "active"}}} = socket
      ) do
    if player?(socket.assigns.game, socket.assigns.current_user) do
      case socket.assigns.selected_square do
        nil ->
          {:noreply, assign(socket, :selected_square, square)}

        ^square ->
          {:noreply, assign(socket, :selected_square, nil)}

        from ->
          case Checkers.move(socket.assigns.current_user, socket.assigns.game.id, from, square) do
            {:ok, game} ->
              {:noreply,
               socket |> assign(:game, game) |> assign(:selected_square, nil) |> refresh()}

            {:error, :invalid_move} ->
              {:noreply,
               socket |> assign(:selected_square, nil) |> put_flash(:error, "Так ходить нельзя.")}

            _error ->
              {:noreply, put_flash(socket, :error, "Не удалось сделать ход.")}
          end
      end
    else
      {:noreply, socket}
    end
  end

  def handle_event("square", _params, socket), do: {:noreply, socket}

  @impl true
  def handle_info({:game_updated, _game_id}, %{assigns: %{current_user: nil}} = socket),
    do: {:noreply, socket}

  def handle_info({:game_updated, game_id}, socket) do
    socket = refresh(socket)

    socket =
      if socket.assigns.game && socket.assigns.game.id == game_id do
        case Checkers.get_game(socket.assigns.current_user, game_id) do
          {:ok, game} -> assign(socket, :game, game)
          _error -> assign(socket, :game, nil)
        end
      else
        socket
      end

    {:noreply, socket}
  end

  def squares, do: for(row <- 0..7, col <- 0..7, do: {row, col, "#{row},#{col}"})
  def dark_square?(row, col), do: rem(row + col, 2) == 1
  def piece_label("W"), do: "♔"
  def piece_label("B"), do: "♚"
  def piece_label(piece) when piece in ~w(w b), do: "●"
  def piece_label(_piece), do: ""
  def piece_color(piece) when piece in ~w(w W), do: "white"
  def piece_color(_piece), do: "black"

  def player?(game, user), do: game.inviter_id == user.id or game.opponent_id == user.id

  def opponent_name(game, user_id) do
    if game.inviter_id == user_id, do: game.opponent.nickname, else: game.inviter.nickname
  end

  defp game_action(socket, action, message) do
    case action.(socket.assigns.current_user) do
      {:ok, game} ->
        {:noreply,
         socket
         |> assign(:game, if(game.status == "active", do: game))
         |> refresh()
         |> put_flash(:info, message)}

      _error ->
        {:noreply, put_flash(socket, :error, "Действие недоступно.")}
    end
  end

  defp refresh(%{assigns: %{current_user: nil}} = socket), do: socket

  defp refresh(socket) do
    user = socket.assigns.current_user

    socket
    |> assign(:opponents, Checkers.list_opponents(user))
    |> assign(:games, Checkers.list_games(user))
    |> assign(:active_games, Checkers.list_active_games(user))
    |> assign(:leaderboard, Checkers.leaderboard())
  end
end
