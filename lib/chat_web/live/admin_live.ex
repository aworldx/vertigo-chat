defmodule ChatWeb.AdminLive do
  use ChatWeb, :live_view

  alias Chat.Admin
  alias ChatWeb.UserAuth

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Админка")
     |> assign(:current_user, nil)
     |> assign(:access, :checking)
     |> assign(:feedback_count, 0)
     |> stream(:feedback_entries, [])}
  end

  @impl true
  def handle_event("authenticate_admin", %{"token" => token}, socket) do
    case UserAuth.verify(token) do
      {:ok, user} -> authorize_admin(socket, user)
      {:error, :invalid_token} -> {:noreply, assign(socket, :access, :unauthenticated)}
    end
  end

  def handle_event("authenticate_admin", _params, socket) do
    {:noreply, assign(socket, :access, :unauthenticated)}
  end

  defp authorize_admin(socket, user) do
    case Admin.list_feedback(user) do
      {:ok, entries} ->
        {:noreply,
         socket
         |> assign(:current_user, user)
         |> assign(:access, :granted)
         |> assign(:feedback_count, length(entries))
         |> stream(:feedback_entries, entries, reset: true)}

      {:error, :forbidden} ->
        {:noreply,
         socket
         |> assign(:current_user, user)
         |> assign(:access, :forbidden)}
    end
  end

  defp feedback_timestamp(entry), do: Calendar.strftime(entry.inserted_at, "%d.%m.%Y · %H:%M UTC")
end
