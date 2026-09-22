# Назначение файла: проверка ссылок YouTube и запуск серверного потока для видеосообщений.
defmodule Chat.YouTube do
  @moduledoc """
  Normalizes links and delegates YouTube search and metadata work to the isolated
  video worker. The worker alone carries the multimedia toolchain.
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
          {:ok,
           %{id: String.t(), source_url: String.t(), duration: pos_integer(), title: String.t()}}
          | {:error, :invalid_youtube | :video_too_long | :video_unavailable}
  def prepare_video(link) do
    with {:ok, video} <- normalize_link(link),
         {:ok, prepared} <- prepare_on_worker(video.source_url) do
      {:ok, Map.merge(video, prepared)}
    end
  end

  # Injectable resolvers keep context/LiveView tests independent of external media tools.
  defp prepare_with_resolvers(link) do
    with {:ok, video} <- normalize_link(link),
         {:ok, duration} <- fetch_duration(video.source_url),
         true <- duration <= @max_duration_seconds do
      {:ok,
       video |> Map.put(:duration, duration) |> Map.put(:title, fetch_title(video.source_url))}
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
      true -> search_on_worker(query)
    end
  end

  def search(_query), do: {:error, :query_required}

  defp search_with_resolvers(query) when is_binary(query) do
    query = String.trim(query)

    cond do
      query == "" -> {:error, :query_required}
      String.length(query) > @max_search_query_length -> {:error, :query_too_long}
      true -> search_videos(query)
    end
  end

  defp search_with_resolvers(_query), do: {:error, :query_required}

  @spec proxy_url(String.t()) :: String.t()
  def proxy_url(video_id) when is_binary(video_id) do
    proxy_base_url =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:proxy_base_url, "")
      |> String.trim_trailing("/")

    proxy_base_url <> "/youtube-proxy/" <> URI.encode(video_id)
  end

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

  defp fetch_duration(source_url) do
    resolver =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:duration_resolver, fn _ -> {:error, :video_unavailable} end)

    case resolver.(source_url) do
      {:ok, duration} when is_number(duration) and duration > 0 -> {:ok, trunc(duration)}
      _result -> {:error, :video_unavailable}
    end
  end

  defp fetch_title(source_url) do
    resolver =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:title_resolver, fn _ -> {:error, :video_unavailable} end)

    case resolver.(source_url) do
      {:ok, title} when is_binary(title) ->
        title
        |> String.trim()
        |> String.slice(0, 160)
        |> case do
          "" -> "YouTube-видео"
          title -> title
        end

      _result ->
        "YouTube-видео"
    end
  end

  defp search_videos(query) do
    resolver =
      Application.get_env(:chat, __MODULE__, [])
      |> Keyword.get(:search_resolver, fn _ -> {:error, :video_unavailable} end)

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

  defp prepare_on_worker(source_url) do
    if local_resolvers_configured?() do
      prepare_with_resolvers(source_url)
      |> case do
        {:ok, %{duration: duration, title: title}} -> {:ok, %{duration: duration, title: title}}
        {:error, _reason} = error -> error
      end
    else
      with {:ok, %{"duration" => duration, "title" => title}} <-
             worker_request("/youtube/prepare", %{"source_url" => source_url}),
           true <- is_number(duration) and duration > 0 and duration <= @max_duration_seconds,
           true <- is_binary(title) do
        {:ok, %{duration: trunc(duration), title: String.slice(String.trim(title), 0, 160)}}
      else
        false -> {:error, :video_unavailable}
        {:error, _reason} = error -> error
        _invalid -> {:error, :video_unavailable}
      end
    end
  end

  defp search_on_worker(query) do
    if local_resolvers_configured?() do
      search_with_resolvers(query)
    else
      with {:ok, %{"videos" => videos}} <- worker_request("/youtube/search", %{"query" => query}) do
        normalize_worker_search_results(videos)
      else
        {:error, _reason} = error -> error
        _invalid -> {:error, :video_unavailable}
      end
    end
  end

  defp worker_request(path, body) do
    config = Application.get_env(:chat, __MODULE__, [])

    with worker_url when is_binary(worker_url) and worker_url != "" <- config[:worker_url],
         {:ok, response} <-
           Req.post(
             String.trim_trailing(worker_url, "/") <> path,
             worker_request_options(config, body)
           ) do
      worker_response(response)
    else
      {:error, _reason} -> {:error, :video_unavailable}
      _unavailable -> {:error, :video_unavailable}
    end
  end

  defp worker_request_options(config, body) do
    options = [
      json: body,
      receive_timeout: Keyword.get(config, :worker_receive_timeout, 30_000),
      retry: false
    ]

    if config[:worker_plug], do: Keyword.put(options, :plug, config[:worker_plug]), else: options
  end

  defp worker_response(%{status: status, body: body}) when status in 200..299 and is_map(body),
    do: {:ok, body}

  defp worker_response(%{body: %{"error" => "invalid_youtube"}}), do: {:error, :invalid_youtube}
  defp worker_response(%{body: %{"error" => "video_too_long"}}), do: {:error, :video_too_long}
  defp worker_response(%{body: %{"error" => "not_found"}}), do: {:error, :not_found}

  defp worker_response(_response), do: {:error, :video_unavailable}

  defp normalize_worker_search_results(videos) when is_list(videos) do
    videos
    |> Enum.flat_map(&search_entry/1)
    |> Enum.filter(&(&1.duration <= @max_duration_seconds))
    |> Enum.take(@max_search_results)
    |> case do
      [] -> {:error, :not_found}
      results -> {:ok, results}
    end
  end

  defp normalize_worker_search_results(_videos), do: {:error, :video_unavailable}

  defp local_resolvers_configured? do
    config = Application.get_env(:chat, __MODULE__, [])

    is_function(config[:duration_resolver], 1) or is_function(config[:title_resolver], 1) or
      is_function(config[:search_resolver], 1)
  end
end
