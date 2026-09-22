defmodule ChatWeb.GalleryPhotoController do
  use ChatWeb, :controller

  def show(conn, %{"id" => id}) do
    result =
      case Integer.parse(id) do
        {id, ""} when id > 0 -> Chat.Gallery.photo_resource(id, :image)
        _ -> :not_found
      end

    ChatWeb.MediaResponse.send(conn, result)
  end

  def thumbnail(conn, %{"id" => id}) do
    result =
      case Integer.parse(id) do
        {id, ""} when id > 0 -> Chat.Gallery.photo_resource(id, :thumbnail)
        _ -> :not_found
      end

    ChatWeb.MediaResponse.send(conn, result)
  end
end
