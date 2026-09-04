defmodule ChatWeb.AdminLive do
  use ChatWeb, :live_view

  alias Chat.Accounts
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
      |> assign(:login_error, nil)
      |> assign(:login_form, to_form(%{"nickname" => "", "password" => ""}, as: :admin_auth))
      |> stream(:feedback_entries, [])

    {:ok, if(connected?(socket), do: authenticate(socket), else: socket)}
  end

  @impl true
  def handle_event("admin_login", %{"admin_auth" => params}, socket) do
    case Accounts.authenticate(params["nickname"], params["password"]) do
      {:ok, user} ->
        {:noreply, authorize_admin(socket, user)}

      {:error, _reason} ->
        {:noreply,
         socket
         |> assign(:access, :unauthenticated)
         |> assign(:login_error, "Неверный ник или пароль.")
         |> assign(:login_form, to_form(params, as: :admin_auth))}
    end
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
