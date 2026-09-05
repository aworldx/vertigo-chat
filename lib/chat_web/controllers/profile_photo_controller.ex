# Назначение файла: отдельная раздача фотографий анкет без передачи бинарных данных через LiveView.
defmodule ChatWeb.ProfilePhotoController do
  use ChatWeb, :controller

  alias Chat.Profiles

  def show(conn, %{"nickname" => nickname}) do
    case Profiles.get_by_nickname(nickname) do
      {:ok, %{photo: photo, photo_content_type: content_type}}
      when is_binary(photo) and is_binary(content_type) ->
        conn
        |> put_resp_content_type(content_type)
        |> put_resp_header("cache-control", "public, max-age=300")
        |> send_resp(:ok, photo)

      _ ->
        send_resp(conn, :not_found, "")
    end
  end
end
