# Назначение файла: LiveView общего фотоальбома, авторизации и загрузки снимков.
defmodule ChatWeb.GalleryLive do
  use ChatWeb, :live_view

  alias Chat.Gallery
  alias ChatWeb.Media
  alias ChatWeb.UserAuth

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Фотоальбом")
     |> assign(:current_user, nil)
     |> assign(:auth_checked?, false)
     |> assign(:upload_form, to_form(%{}, as: :gallery))
     |> allow_upload(:gallery_photo,
       accept: ~w(.jpg .jpeg .png .webp),
       max_entries: 1,
       max_file_size: 2_000_000
     )
     |> stream(:photos, Gallery.list_photos())}
  end

  @impl true
  def handle_event("authenticate_gallery", %{"token" => token}, socket) do
    case UserAuth.verify(token) do
      {:ok, user} ->
        {:noreply, socket |> assign(:current_user, user) |> assign(:auth_checked?, true)}

      {:error, :invalid_token} ->
        {:noreply, socket |> assign(:current_user, nil) |> assign(:auth_checked?, true)}
    end
  end

  def handle_event("authenticate_gallery", _params, socket) do
    {:noreply, socket |> assign(:current_user, nil) |> assign(:auth_checked?, true)}
  end

  def handle_event("validate_gallery_photo", _params, socket), do: {:noreply, socket}

  def handle_event("upload_gallery_photo", _params, socket) do
    with %{id: _user_id} = user <- socket.assigns.current_user,
         {:ok, photo} <- consume_photo(socket, user) do
      {:noreply,
       socket
       |> stream_insert(:photos, photo, at: 0)
       |> put_flash(:info, "Фотография добавлена в альбом.")}
    else
      {:error, :daily_photo_limit_reached} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Дневной лимит — #{Gallery.max_photos_per_day()} фотографий. Попробуй завтра."
         )}

      {:error, :photo_limit_reached} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "В альбоме одного автора может быть не больше #{Gallery.max_photos_per_user()} фотографий."
         )}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось загрузить фотографию.")}
    end
  end

  def image_url(photo), do: Media.data_url(photo.image, photo.content_type)

  defp consume_photo(socket, user) do
    case uploaded_entries(socket, :gallery_photo) do
      {[_entry], []} ->
        [result] =
          consume_uploaded_entries(socket, :gallery_photo, fn %{path: path}, entry ->
            {:ok, {File.read!(path), entry.client_type}}
          end)

        {bytes, content_type} = result
        Gallery.upload_photo(user, bytes, content_type)

      _entries ->
        {:error, :photo_not_ready}
    end
  end
end
