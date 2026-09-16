# Назначение файла: серверная ретрансляция видео YouTube в браузер чатланина.
defmodule ChatWeb.YouTubeProxyController do
  use ChatWeb, :controller

  alias Chat.YouTube

  @chunk_timeout 30_000

  def show(conn, %{"id" => video_id}) do
    case YouTube.open_stream(video_id) do
      {:ok, port} ->
        conn
        |> put_resp_content_type("video/mp4")
        |> put_resp_header("cache-control", "no-store")
        |> put_resp_header("accept-ranges", "none")
        |> send_chunked(:ok)
        |> stream(port)

      {:error, :stream_unavailable} ->
        send_resp(conn, :service_unavailable, "")
    end
  end

  def show(conn, _params), do: send_resp(conn, :bad_request, "")

  defp stream(conn, port) do
    receive do
      {^port, {:data, data}} ->
        case chunk(conn, data) do
          {:ok, conn} -> stream(conn, port)
          {:error, _reason} -> close_port(port)
        end

      {^port, {:exit_status, _status}} ->
        conn
    after
      @chunk_timeout ->
        close_port(port)
    end
  end

  defp close_port(port) do
    Port.close(port)
    :ok
  rescue
    ArgumentError -> :ok
  end
end
