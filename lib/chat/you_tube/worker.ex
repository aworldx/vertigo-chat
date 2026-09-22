# Назначение файла: отдельный HTTP-процесс для подготовки и выдачи кэшированных YouTube-видео.
defmodule Chat.YouTube.Worker do
  @moduledoc false

  use Plug.Router

  alias Chat.YouTube

  plug :match
  plug :dispatch

  get "/health" do
    send_resp(conn, :ok, "ok")
  end

  post "/youtube/search" do
    with {:ok, %{"query" => query}} <- read_json(conn),
         {:ok, videos} <- YouTube.search_locally(query) do
      send_json(conn, :ok, %{videos: videos})
    else
      {:error, :query_required} ->
        send_json(conn, :unprocessable_entity, %{error: "query_required"})

      {:error, :query_too_long} ->
        send_json(conn, :unprocessable_entity, %{error: "query_too_long"})

      {:error, :not_found} ->
        send_json(conn, :not_found, %{error: "not_found"})

      _error ->
        send_json(conn, :bad_gateway, %{error: "video_unavailable"})
    end
  end

  post "/youtube/prepare" do
    with {:ok, %{"source_url" => source_url}} <- read_json(conn),
         {:ok, %{duration: duration, title: title}} <- YouTube.prepare_video_locally(source_url) do
      send_json(conn, :ok, %{duration: duration, title: title})
    else
      {:error, :invalid_youtube} ->
        send_json(conn, :unprocessable_entity, %{error: "invalid_youtube"})

      {:error, :video_too_long} ->
        send_json(conn, :unprocessable_entity, %{error: "video_too_long"})

      _error ->
        send_json(conn, :bad_gateway, %{error: "video_unavailable"})
    end
  end

  get "/youtube-proxy/:video_id" do
    case YouTube.Cache.request(video_id) do
      {:ok, %{path: path, size: size}} ->
        send_video(conn, path, size)

      :pending ->
        conn |> put_resp_header("retry-after", "1") |> send_resp(:accepted, "")
    end
  end

  match _ do
    send_resp(conn, :not_found, "")
  end

  defp read_json(conn) do
    with {:ok, body, _conn} <- read_body(conn),
         {:ok, payload} when is_map(payload) <- Jason.decode(body) do
      {:ok, payload}
    else
      _invalid -> {:error, :invalid_json}
    end
  end

  defp send_json(conn, status, payload) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(payload))
  end

  defp send_video(conn, path, size) do
    conn =
      conn
      |> put_resp_content_type("video/mp4")
      |> put_resp_header("accept-ranges", "bytes")
      |> put_resp_header("access-control-allow-origin", "*")
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
