# Назначение файла: проверка ссылок YouTube и запуск серверного потока для видеосообщений.
defmodule Chat.YouTube do
  @moduledoc """
  Normalizes YouTube links accepted by the chat and starts `yt-dlp` streaming.

  The downloader runs on the application host; browsers receive video bytes only
  from the local `/youtube-proxy/:id` endpoint.
  """

  @video_id_pattern ~r/\A[A-Za-z0-9_-]{11}\z/
  @max_duration_seconds 20 * 60
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

  @spec proxy_url(String.t()) :: String.t()
  def proxy_url(video_id) when is_binary(video_id), do: "/youtube-proxy/" <> URI.encode(video_id)

  @spec open_stream(String.t()) :: {:ok, port()} | {:error, :stream_unavailable}
  def open_stream(video_id) when is_binary(video_id) do
    with true <- Regex.match?(@video_id_pattern, video_id),
         yt_dlp when is_binary(yt_dlp) <- executable_path(:yt_dlp),
         ffmpeg when is_binary(ffmpeg) <- executable_path(:ffmpeg) do
      port =
        Port.open({:spawn_executable, ~c"/bin/sh"}, [
          :binary,
          :exit_status,
          :use_stdio,
          args: [~c"-c", shell_command(yt_dlp, ffmpeg, video_id)]
        ])

      {:ok, port}
    else
      _unavailable -> {:error, :stream_unavailable}
    end
  rescue
    ArgumentError -> {:error, :stream_unavailable}
  end

  def open_stream(_video_id), do: {:error, :stream_unavailable}

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

  defp shell_command(yt_dlp, ffmpeg, video_id) do
    "#{yt_dlp} --quiet --no-warnings --no-playlist --no-part " <>
      "--format 'bestvideo[vcodec^=avc1][height<=360]+bestaudio[acodec^=mp4a]/best[ext=mp4][height<=360]' " <>
      "--output - 'https://www.youtube.com/watch?v=#{video_id}' | " <>
      "#{ffmpeg} -hide_banner -loglevel error -i pipe:0 -c copy -bsf:a aac_adtstoasc " <>
      "-movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1"
  end
end
