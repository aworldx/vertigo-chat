# Назначение файла: проверка ссылок YouTube и запуск серверного потока для видеосообщений.
defmodule Chat.YouTube do
  @moduledoc """
  Normalizes links, searches YouTube, and prepares Safari-compatible cached MP4 files.
  """

  @video_id_pattern ~r/\A[A-Za-z0-9_-]{11}\z/
  @max_duration_seconds 20 * 60
  @max_search_results 5
  @max_search_query_length 200
  @youtube_hosts ["youtube.com", "www.youtube.com", "m.youtube.com"]
  @short_hosts ["youtu.be", "www.youtu.be"]

  @spec normalize_link(String.t()) ::
          {:ok, %{id: String.t(), source_url: String.t()}} | {:error, :invalid_youtube}
  def normalize_link(link) when is_binary(link) do
    link = String.trim(link)

    with %URI{scheme: scheme, host: host} = uri when scheme in ["http", "https"] <-
           URI.parse(link),
         host when is_binary(host) <- String.downcase(host),
         {:ok, id} <- video_id(uri, host),
         true <- Regex.match?(@video_id_pattern, id) do
      {:ok, %{id: id, source_url: "https://www.youtube.com/watch?v=#{id}"}}
    else
      _invalid -> {:error, :invalid_youtube}
    end
  end

  def normalize_link(_link), do: {:error, :invalid_youtube}

  @spec prepare_video(String.t()) ::
          {:ok, %{id: String.t(), source_url: String.t(), duration: pos_integer()}}
          | {:error, :invalid_youtube | :video_too_long | :video_unavailable}
  def prepare_video(link) do
    with {:ok, video} <- normalize_link(link),
         {:ok, duration} <- fetch_duration(video.source_url),
         true <- duration <= @max_duration_seconds do
      {:ok, Map.put(video, :duration, duration)}
    else
      false -> {:error, :video_too_long}
      {:error, _reason} = error -> error
    end
  end

  def max_duration_seconds, do: @max_duration_seconds
  def max_search_results, do: @max_search_results

  def search(query) when is_binary(query) do
    query = String.trim(query)

    cond do
      query == "" -> {:error, :query_required}
      String.length(query) > @max_search_query_length -> {:error, :query_too_long}
      true -> search_videos(query)
    end
  end

  def search(_query), do: {:error, :query_required}

  @spec proxy_url(String.t()) :: String.t()
  def proxy_url(video_id) when is_binary(video_id), do: "/youtube-proxy/" <> URI.encode(video_id)

  def download_to_file(video_id, path) when is_binary(video_id) and is_binary(path) do
    with true <- Regex.match?(@video_id_pattern, video_id),
         yt_dlp when is_binary(yt_dlp) <- executable_path(:yt_dlp),
         ffmpeg when is_binary(ffmpeg) <- executable_path(:ffmpeg) do
      downloader = Application.get_env(:chat, __MODULE__, []) |> Keyword.get(:download_fun)

      result =
        if is_function(downloader, 2),
          do: downloader.(video_id, path),
          else: download_with_yt_dlp(yt_dlp, ffmpeg, video_id, path)

      if result == :ok, do: :ok, else: {:error, :download_failed}
    else
      _unavailable -> {:error, :stream_unavailable}
    end
  end

  def download_to_file(_video_id, _path), do: {:error, :stream_unavailable}

  defp video_id(%URI{path: "/watch", query: query}, host) when host in @youtube_hosts do
    case URI.decode_query(query || "") do
      %{"v" => id} -> {:ok, id}
      _params -> {:error, :invalid_youtube}
    end
  end

  defp video_id(%URI{path: "/shorts/" <> id}, host) when host in @youtube_hosts,
    do: {:ok, String.split(id, "/", parts: 2) |> hd()}

  defp video_id(%URI{path: "/embed/" <> id}, host) when host in @youtube_hosts,
    do: {:ok, String.split(id, "/", parts: 2) |> hd()}

  defp video_id(%URI{path: "/" <> id}, host) when host in @short_hosts,
    do: {:ok, String.split(id, "/", parts: 2) |> hd()}

  defp video_id(_uri, _host), do: {:error, :invalid_youtube}

  defp executable_path(:yt_dlp) do
    config = Application.get_env(:chat, __MODULE__, [])
    configured_path = Keyword.get(config, :yt_dlp_path)

    Enum.find(
      [configured_path, System.find_executable("yt-dlp"), "/opt/homebrew/bin/yt-dlp"],
      fn path ->
        is_binary(path) and File.regular?(path)
      end
    )
  end

  defp executable_path(:ffmpeg) do
    config = Application.get_env(:chat, __MODULE__, [])
    configured_path = Keyword.get(config, :ffmpeg_path)

    Enum.find(
      [configured_path, System.find_executable("ffmpeg"), "/opt/homebrew/bin/ffmpeg"],
      fn path ->
        is_binary(path) and File.regular?(path)
      end
    )
  end

  defp fetch_duration(source_url) do
    resolver =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:duration_resolver, &fetch_duration_with_yt_dlp/1)

    case resolver.(source_url) do
      {:ok, duration} when is_number(duration) and duration > 0 -> {:ok, trunc(duration)}
      _result -> {:error, :video_unavailable}
    end
  end

  defp fetch_duration_with_yt_dlp(source_url) do
    with path when is_binary(path) <- executable_path(:yt_dlp),
         {output, 0} <-
           System.cmd(
             path,
             [
               "--quiet",
               "--no-warnings",
               "--no-playlist",
               "--skip-download",
               "--print",
               "%(duration)s",
               source_url
             ],
             stderr_to_stdout: true
           ),
         {duration, ""} <- output |> String.trim() |> Float.parse() do
      {:ok, duration}
    else
      _unavailable -> {:error, :video_unavailable}
    end
  end

  defp search_videos(query) do
    resolver =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:search_resolver, &search_with_yt_dlp/1)

    case resolver.(query) do
      {:ok, videos} when is_list(videos) ->
        videos
        |> Enum.flat_map(&search_entry/1)
        |> Enum.filter(&(&1.duration <= @max_duration_seconds))
        |> Enum.take(@max_search_results)
        |> case do
          [] -> {:error, :not_found}
          videos -> {:ok, videos}
        end

      {:error, _reason} = error ->
        error

      _invalid ->
        {:error, :video_unavailable}
    end
  end

  defp search_entry(%{"id" => id, "title" => title, "duration" => duration})
       when is_binary(id) and is_binary(title) and is_number(duration) do
    if Regex.match?(@video_id_pattern, id) and duration > 0,
      do: [
        %{
          id: id,
          title: title,
          duration: trunc(duration),
          source_url: "https://www.youtube.com/watch?v=#{id}"
        }
      ],
      else: []
  end

  defp search_entry(_entry), do: []

  defp search_with_yt_dlp(query) do
    with path when is_binary(path) <- executable_path(:yt_dlp),
         {output, 0} <-
           System.cmd(
             path,
             [
               "--quiet",
               "--no-warnings",
               "--no-playlist",
               "--dump-single-json",
               "ytsearch#{@max_search_results}:#{query}"
             ],
             stderr_to_stdout: true
           ),
         {:ok, %{"entries" => entries}} <- Jason.decode(output) do
      {:ok, entries}
    else
      _error -> {:error, :video_unavailable}
    end
  end

  defp download_with_yt_dlp(yt_dlp, ffmpeg, video_id, path) do
    temporary_path = path <> ".part"
    File.rm(temporary_path)

    command =
      shell_command(yt_dlp, ffmpeg, video_id, temporary_path) <>
        " && mv " <> shell_escape(temporary_path) <> " " <> shell_escape(path)

    case System.cmd("/bin/sh", ["-c", command], stderr_to_stdout: true) do
      {_output, 0} -> :ok
      _error -> {:error, :download_failed}
    end
  end

  defp shell_command(yt_dlp, ffmpeg, video_id, output_path) do
    "#{shell_escape(yt_dlp)} --quiet --no-warnings --no-playlist --no-part " <>
      "--format 'bestvideo[vcodec^=avc1][height<=360]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=360]' " <>
      "--output - 'https://www.youtube.com/watch?v=#{video_id}' | " <>
      "#{shell_escape(ffmpeg)} -hide_banner -loglevel error -i pipe:0 -c copy -bsf:a aac_adtstoasc -movflags +faststart -f mp4 #{shell_escape(output_path)}"
  end

  defp shell_escape(value), do: "'" <> String.replace(value, "'", "'\\\"'\\\"'") <> "'"
end
