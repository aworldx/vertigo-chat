defmodule ChatWeb.AdminLive do
  use ChatWeb, :live_view

  alias Chat.Admin
  alias ChatWeb.UserAuth

  @impl true
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, "Админка")
      |> assign(:current_user, nil)
      |> assign(:access, :checking)
      |> assign(:feedback_count, 0)
      |> stream(:feedback_entries, [])

    {:ok, if(connected?(socket), do: authenticate(socket), else: socket)}
  end

  defp authorize_admin(socket, user) do
    case Admin.list_feedback(user) do
      {:ok, entries} ->
        socket
        |> assign(:current_user, user)
        |> assign(:access, :granted)
        |> assign(:feedback_count, length(entries))
        |> stream(:feedback_entries, entries, reset: true)

      {:error, :forbidden} ->
        socket
        |> assign(:current_user, user)
        |> assign(:access, :forbidden)
    end
  end

  defp authenticate(socket) do
    with %{"user_auth_token" => token} <- get_connect_params(socket),
         {:ok, user} <- UserAuth.verify(token) do
      authorize_admin(socket, user)
    else
      _invalid -> assign(socket, :access, :unauthenticated)
    end
  end

  defp feedback_timestamp(entry), do: Calendar.strftime(entry.inserted_at, "%d.%m.%Y · %H:%M UTC")
end
