# Назначение файла: LiveView общего фотоальбома, авторизации и загрузки снимков.
defmodule ChatWeb.GalleryLive do
  use ChatWeb, :live_view

  import ChatWeb.AccountComponents

  alias Chat.Gallery
  alias Chat.Ranks

  @impl true
  def mount(_params, _session, socket) do
    current_user = socket.assigns.current_account_user
    if connected?(socket), do: Gallery.subscribe()

    {:ok,
     socket
     |> assign(:page_title, "Фотоальбом")
     |> assign(:meta_description, "Фотоальбом сообщества Vertigo.")
     |> assign(:robots, "noindex, follow")
     |> assign(:current_user, current_user)
     |> assign(:can_add_gallery_photos?, Ranks.can_add_gallery_photos?(current_user))
     |> assign(:auth_checked?, true)
     |> assign(:gallery_upload_error, nil)
     |> assign(:upload_form, to_form(%{}, as: :gallery))
     |> allow_upload(:gallery_photo,
       accept: ~w(.jpg .jpeg .png .webp),
       max_entries: 1,
       max_file_size: 2_000_000
     )
     |> stream(:photos, Gallery.list_photos(current_user))}
  end

  @impl true
  def handle_event("authenticate_gallery", _params, socket), do: {:noreply, socket}

  def handle_event(
        "toggle_gallery_like",
        %{"id" => id},
        %{assigns: %{current_user: user}} = socket
      )
      when not is_nil(user) do
    with {photo_id, ""} <- Integer.parse(id),
         {:ok, _state} <- Gallery.toggle_like(user, photo_id) do
      {:noreply, refresh_photos(socket)}
    else
      {:error, :own_photo} ->
        {:noreply, put_flash(socket, :error, "Свою фотографию уже можно считать любимой.")}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось изменить оценку фотографии.")}
    end
  end

  def handle_event("toggle_gallery_like", _params, socket) do
    {:noreply,
     put_flash(socket, :error, "Войди с зарегистрированным ником, чтобы ставить лайки.")}
  end

  def handle_event("validate_gallery_photo", %{"gallery" => params}, socket) do
    {:noreply,
     socket
     |> assign(:upload_form, to_form(params, as: :gallery))
     |> assign(:gallery_upload_error, nil)}
  end

  def handle_event("validate_gallery_photo", _params, socket), do: {:noreply, socket}

  def handle_event("gallery_compression_error", _params, socket) do
    {:noreply,
     assign(
       socket,
       :gallery_upload_error,
       "Не удалось прочитать изображение. Выберите исправный JPG, PNG или WebP."
     )}
  end

  def handle_event("upload_gallery_photo", params, socket) do
    caption = get_in(params, ["gallery", "caption"])

    with %{id: _user_id} = user <- socket.assigns.current_user,
         {:ok, photo} <- consume_photo(socket, user, caption) do
      {:noreply,
       socket
       |> assign(:upload_form, to_form(%{}, as: :gallery))
       |> assign(:gallery_upload_error, nil)
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

      {:error, :invalid_caption} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Подпись должна быть не длиннее #{Gallery.max_caption_length()} символов."
         )}

      {:error, :statist_required} ->
        {:noreply,
         put_flash(socket, :error, "Добавлять фото могут чатлане со званием «Статист».")}

      _reason ->
        {:noreply, put_flash(socket, :error, "Не удалось загрузить фотографию.")}
    end
  end

  @impl true
  def handle_info(:gallery_changed, socket), do: {:noreply, refresh_photos(socket)}

  def image_url(photo), do: ~p"/gallery/photos/#{photo.id}"

  def thumbnail_url(%{thumbnail_key: key} = photo) when is_binary(key),
    do: ~p"/gallery/photos/#{photo.id}/thumbnail"

  def thumbnail_url(%{thumbnail: thumbnail} = photo) when is_binary(thumbnail),
    do: ~p"/gallery/photos/#{photo.id}/thumbnail"

  def thumbnail_url(photo), do: image_url(photo)

  def upload_error_message(:too_large),
    do: "Фотография слишком большая: после сжатия файл должен быть не больше 2 МБ."

  def upload_error_message(:not_accepted),
    do: "Неподдерживаемый формат. Выберите фотографию в формате JPG, PNG или WebP."

  def upload_error_message(:too_many_files), do: "Можно добавить только одну фотографию за раз."
  def upload_error_message(_error), do: "Не удалось подготовить фотографию к загрузке."

  def gallery_upload_errors(upload) do
    upload_errors(upload) ++
      Enum.flat_map(upload.entries, &upload_errors(upload, &1))
  end

  defp consume_photo(socket, user, caption) do
    case uploaded_entries(socket, :gallery_photo) do
      {[_entry], []} ->
        [result] =
          consume_uploaded_entries(socket, :gallery_photo, fn %{path: path}, entry ->
            {:ok, {File.read!(path), entry.client_type}}
          end)

        {bytes, content_type} = result

        {thumbnail, thumbnail_content_type} =
          thumbnail_from_params(socket.assigns.upload_form.params)

        Gallery.upload_photo(
          user,
          bytes,
          content_type,
          caption,
          thumbnail,
          thumbnail_content_type
        )

      _entries ->
        {:error, :photo_not_ready}
    end
  end

  defp thumbnail_from_params(%{"thumbnail" => "data:image/webp;base64," <> encoded}) do
    case Base.decode64(encoded) do
      {:ok, thumbnail} -> {thumbnail, "image/webp"}
      :error -> {nil, nil}
    end
  end

  defp thumbnail_from_params(_params), do: {nil, nil}

  defp refresh_photos(socket),
    do: stream(socket, :photos, Gallery.list_photos(socket.assigns.current_user), reset: true)
end
