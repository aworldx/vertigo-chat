# Назначение файла: раздача фотографий альбома отдельными HTTP-ответами, без передачи бинарных данных через LiveView.
defmodule ChatWeb.GalleryPhotoController do
  use ChatWeb, :controller

  alias Chat.Gallery

  def show(conn, %{"id" => id}) do
    with {:ok, id} <- parse_id(id),
         %{image: image, content_type: content_type} <- Gallery.get_photo(id),
         true <- is_binary(image) and is_binary(content_type) do
      send_image(conn, image, content_type)
    else
      _ -> send_resp(conn, :not_found, "")
    end
  end

  def thumbnail(conn, %{"id" => id}) do
    with {:ok, id} <- parse_id(id),
         %{thumbnail: thumbnail, thumbnail_content_type: content_type} <- Gallery.get_photo(id),
         true <- is_binary(thumbnail) and is_binary(content_type) do
      send_image(conn, thumbnail, content_type)
    else
      _ -> send_resp(conn, :not_found, "")
    end
  end

  defp send_image(conn, image, content_type) do
    conn
    |> put_resp_content_type(content_type)
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(:ok, image)
  end

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {number, ""} when number > 0 -> {:ok, number}
      _ -> :error
    end
  end

  defp parse_id(_id), do: :error
end
