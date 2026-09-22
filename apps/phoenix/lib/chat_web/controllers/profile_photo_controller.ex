defmodule ChatWeb.ProfilePhotoController do
  use ChatWeb, :controller

  alias Chat.Profiles
  alias Chat.Profiles.GoAPI

  def show(conn, %{"nickname" => nickname}) do
    send_photo(conn, nickname, false)
  end

  def thumbnail(conn, %{"nickname" => nickname}) do
    send_photo(conn, nickname, true)
  end

  defp send_photo(conn, nickname, thumbnail?) do
    if GoAPI.enabled?() do
      case GoAPI.photo(nickname, thumbnail?) do
        {:ok, 200, bytes, content_type} ->
          conn
          |> put_resp_content_type(content_type)
          |> put_resp_header("cache-control", "public, max-age=300")
          |> send_resp(:ok, bytes)

        {:ok, 404, _body, _content_type} ->
          send_resp(conn, :not_found, "")

        _ ->
          send_resp(conn, :bad_gateway, "")
      end
    else
      field = if thumbnail?, do: :thumbnail, else: :photo
      ChatWeb.MediaResponse.send(conn, Profiles.photo_resource(nickname, field))
    end
  end
end
