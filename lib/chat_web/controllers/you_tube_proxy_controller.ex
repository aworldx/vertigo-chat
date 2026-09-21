# Назначение файла: серверная ретрансляция видео YouTube в браузер чатланина.
defmodule ChatWeb.YouTubeProxyController do
  use ChatWeb, :controller

  alias Chat.YouTube

  def show(conn, %{"id" => video_id}) do
    case YouTube.Cache.request(video_id) do
      {:ok, %{path: path, size: size}} ->
        send_video(conn, path, size)

      :pending ->
        conn |> put_resp_header("retry-after", "1") |> send_resp(:accepted, "")
    end
  end

  def show(conn, _params), do: send_resp(conn, :bad_request, "")

  defp send_video(conn, path, size) do
    conn =
      conn
      |> put_resp_content_type("video/mp4")
      |> put_resp_header("accept-ranges", "bytes")
      |> put_resp_header("cache-control", "private, max-age=3600")

    case range(conn, size) do
      {:ok, start, length} ->
        conn
        |> put_resp_header("content-range", "bytes #{start}-#{start + length - 1}/#{size}")
        |> put_resp_header("content-length", Integer.to_string(length))
        |> send_file(:partial_content, path, start, length)

      :none ->
        conn |> put_resp_header("content-length", Integer.to_string(size)) |> send_file(:ok, path)

      :invalid ->
        conn
        |> put_resp_header("content-range", "bytes */#{size}")
        |> send_resp(:range_not_satisfiable, "")
    end
  end

  defp range(conn, size) do
    case get_req_header(conn, "range") do
      [] -> :none
      ["bytes=" <> value] -> parse_range(value, size)
      _other -> :invalid
    end
  end

  defp parse_range(value, size) do
    case String.split(value, "-", parts: 2) do
      [start, ""] when start != "" ->
        with {start, ""} <- Integer.parse(start),
             true <- start < size,
             do: {:ok, start, size - start},
             else: (_ -> :invalid)

      [start, finish] when start != "" ->
        with {start, ""} <- Integer.parse(start),
             {finish, ""} <- Integer.parse(finish),
             true <- start <= finish and start < size,
             do: {:ok, start, min(finish, size - 1) - start + 1},
             else: (_ -> :invalid)

      ["", suffix] ->
        with {suffix, ""} <- Integer.parse(suffix),
             true <- suffix > 0,
             do: {:ok, max(size - suffix, 0), min(suffix, size)},
             else: (_ -> :invalid)

      _invalid ->
        :invalid
    end
  end
end
