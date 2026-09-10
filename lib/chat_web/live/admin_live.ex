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
      |> assign(:robots, "noindex, nofollow")
      |> assign(:current_user, nil)
      |> assign(:access, :checking)
      |> assign(:feedback_count, 0)
      |> assign(:karmik_assessment_count, 0)
      |> assign(:login_error, nil)
      |> assign(:login_form, to_form(%{"nickname" => "", "password" => ""}, as: :admin_auth))
      |> assign(:emoji_form, to_form(%{"code" => ""}, as: :emoji))
      |> assign(:emoji_upload_error, nil)
      |> allow_upload(:emoji_image, accept: ~w(.png), max_entries: 1, max_file_size: 100_000)
      |> stream(:feedback_entries, [])
      |> stream(:karmik_assessments, [])
      |> stream(:emojis, [])

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

  def handle_event("upload_emoji", %{"emoji" => %{"code" => code}}, socket) do
    case consume_emoji(socket, socket.assigns.current_user, code) do
      {:ok, emoji} ->
        {:noreply,
         socket
         |> assign(:emoji_form, to_form(%{"code" => ""}, as: :emoji))
         |> assign(:emoji_upload_error, nil)
         |> stream_insert(:emojis, emoji)
         |> put_flash(:info, "Смайл #{emoji.code} добавлен.")}

      {:error, :too_large_dimensions} ->
        {:noreply,
         assign(
           socket,
           :emoji_upload_error,
           "Размер смайла не должен превышать 30 × 30 пикселей."
         )}

      {:error, _reason} ->
        {:noreply,
         assign(
           socket,
           :emoji_upload_error,
           "Не удалось добавить смайл. Нужен PNG до 100 КБ и уникальный код."
         )}
    end
  end

  defp authorize_admin(socket, user) do
    with {:ok, entries} <- Admin.list_feedback(user),
         {:ok, assessments} <- Admin.list_karmik_assessments(user),
         {:ok, emojis} <- Admin.list_emojis(user) do
      socket
      |> assign(:current_user, user)
      |> assign(:access, :granted)
      |> assign(:feedback_count, length(entries))
      |> assign(:karmik_assessment_count, length(assessments))
      |> stream(:feedback_entries, entries, reset: true)
      |> stream(:karmik_assessments, assessments, reset: true)
      |> stream(:emojis, emojis, reset: true)
    else
      {:error, :forbidden} ->
        socket
        |> assign(:current_user, user)
        |> assign(:access, :forbidden)
    end
  end

  def emoji_url(emoji), do: ~p"/emojis/#{emoji.id}"

  defp consume_emoji(socket, user, code) do
    case uploaded_entries(socket, :emoji_image) do
      {[_entry], []} ->
        [result] =
          consume_uploaded_entries(socket, :emoji_image, fn %{path: path}, entry ->
            {:ok, {File.read!(path), entry.client_type}}
          end)

        {image, content_type} = result
        Admin.create_emoji(user, code, image, content_type)

      _entries ->
        {:error, :upload_not_ready}
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

  defp assessment_timestamp(entry),
    do: Calendar.strftime(entry.inserted_at, "%d.%m.%Y · %H:%M UTC")
end
