defmodule ChatWeb.EmojiController do
  use ChatWeb, :controller

  alias Chat.Emojis

  def show(conn, %{"id" => id}) do
    with {id, ""} when id > 0 <- Integer.parse(id),
         %{image: image, content_type: content_type} <- Emojis.get(id) do
      conn
      |> put_resp_content_type(content_type)
      |> put_resp_header("cache-control", "public, max-age=300")
      |> send_resp(:ok, image)
    else
      _ -> send_resp(conn, :not_found, "")
    end
  end
end
