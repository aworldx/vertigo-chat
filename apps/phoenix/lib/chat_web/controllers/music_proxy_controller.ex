defmodule ChatWeb.MusicProxyController do
  use ChatWeb, :controller

  alias Chat.Music

  def show(conn, %{"url" => url}) do
    case Music.fetch_audio(url) do
      {:ok, body} ->
        conn
        |> put_resp_content_type("audio/mpeg")
        |> put_resp_header("cache-control", "public, max-age=3600")
        |> send_resp(:ok, body)

      {:error, _reason} ->
        send_resp(conn, :not_found, "")
    end
  end

  def show(conn, _params), do: send_resp(conn, :bad_request, "")
end
