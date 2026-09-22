defmodule ChatWeb.GifProxyController do
  use ChatWeb, :controller

  alias Chat.Gifs

  def show(conn, %{"url" => url}) do
    case Gifs.fetch_media(url) do
      {:ok, body, content_type} ->
        conn
        |> put_resp_content_type(content_type)
        |> put_resp_header("cache-control", "public, max-age=3600")
        |> send_resp(:ok, body)

      {:error, _reason} ->
        send_resp(conn, :not_found, "")
    end
  end

  def show(conn, _params), do: send_resp(conn, :bad_request, "")
end
