# Назначение файла: приватные настройки форумного email зарегистрированного пользователя.
defmodule ChatWeb.AccountLive do
  use ChatWeb, :live_view

  alias Chat.Accounts

  @impl true
  def mount(_params, _session, %{assigns: %{current_account_user: nil}} = socket) do
    {:ok,
     socket
     |> put_flash(:error, "Сначала войди в аккаунт чата.")
     |> push_navigate(to: ~p"/library")}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_account_user

    {:ok,
     socket
     |> assign(:page_title, "Настройки аккаунта")
     |> assign(:email_form, email_form(user))}
  end

  @impl true
  def handle_event("save_forum_email", %{"forum_email" => params}, socket) do
    user = socket.assigns.current_account_user

    case Accounts.update_forum_email(user, params) do
      {:ok, updated_user} ->
        {:noreply,
         socket
         |> assign(:current_account_user, updated_user)
         |> assign(:email_form, email_form(updated_user))
         |> put_flash(:info, "Email сохранён. Форум подтвердит его при первом входе.")}

      {:error, changeset} ->
        {:noreply, assign(socket, :email_form, to_form(changeset, as: :forum_email))}
    end
  end

  defp email_form(user), do: user |> Accounts.change_forum_email() |> to_form(as: :forum_email)
end
