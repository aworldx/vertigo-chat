defmodule Chat.Music do
  @moduledoc "Searches MP3mn's public catalogue and returns playable track metadata."

  @endpoint "https://mp3mn.net/"
  @max_results 5
  @max_query_length 120

  @type track :: %{
          artist: String.t(),
          title: String.t(),
          duration: String.t(),
          audio_url: String.t(),
          source_url: String.t()
        }

  @spec search(String.t()) :: {:ok, [track()]} | {:error, atom()}
  def search(query) when is_binary(query) do
    query = String.trim(query)

    cond do
      query == "" -> {:error, :query_required}
      String.length(query) > @max_query_length -> {:error, :query_too_long}
      true -> fetch_results(query)
    end
  end

  def search(_query), do: {:error, :query_required}

  @spec normalize_track(map()) :: {:ok, track()} | {:error, :invalid_track}
  def normalize_track(track) when is_map(track) do
    normalized = %{
      artist: normalize_text(Map.get(track, :artist) || Map.get(track, "artist"), 160),
      title: normalize_text(Map.get(track, :title) || Map.get(track, "title"), 160),
      duration: normalize_text(Map.get(track, :duration) || Map.get(track, "duration"), 12),
      audio_url: Map.get(track, :audio_url) || Map.get(track, "audio_url"),
      source_url: Map.get(track, :source_url) || Map.get(track, "source_url")
    }

    if valid_track?(normalized), do: {:ok, normalized}, else: {:error, :invalid_track}
  end

  def normalize_track(_track), do: {:error, :invalid_track}

  @spec proxy_url(String.t()) :: String.t()
  def proxy_url(url) when is_binary(url) do
    "/music-proxy?" <> URI.encode_query(%{"url" => url})
  end

  @spec fetch_audio(String.t()) :: {:ok, binary()} | {:error, atom()}
  def fetch_audio(url) when is_binary(url) do
    config = Application.get_env(:chat, __MODULE__, [])

    options = [
      headers: [{"accept", "audio/mpeg,audio/*;q=0.9,*/*;q=0.1"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 15_000),
      retry: Keyword.get(config, :retry, :transient)
    ]

    options = if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options

    with true <- valid_audio_url?(url),
         {:ok, response} <- Req.get(url, options),
         true <- response.status in 200..299,
         true <- is_binary(response.body),
         :ok <- audio_content_type(response.headers) do
      {:ok, response.body}
    else
      false -> {:error, :audio_unavailable}
      {:error, _reason} -> {:error, :audio_unavailable}
      _unexpected -> {:error, :audio_unavailable}
    end
  end

  def fetch_audio(_url), do: {:error, :audio_unavailable}

  defp fetch_results(query) do
    config = Application.get_env(:chat, __MODULE__, [])

    with {:ok, response} <-
           Req.get(config[:endpoint] || @endpoint, request_options(config, query)),
         :ok <- successful_status(response.status),
         tracks = parse_tracks(response.body, config[:endpoint] || @endpoint),
         false <- tracks == [] do
      {:ok, tracks}
    else
      true -> {:error, :not_found}
      {:error, _reason} -> {:error, :provider_unavailable}
      _unexpected -> {:error, :provider_unavailable}
    end
  end

  defp request_options(config, query) do
    options = [
      params: [song: query],
      headers: [{"user-agent", "VertigoChat/1.0 (+https://mp3mn.net/)"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 10_000),
      retry: Keyword.get(config, :retry, :transient)
    ]

    if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options
  end

  defp successful_status(status) when status in 200..299, do: :ok
  defp successful_status(_status), do: {:error, :provider_unavailable}

  defp parse_tracks(body, endpoint) when is_binary(body) do
    ~r/<li(?:\s[^>]*)?>(.*?)<\/li>/s
    |> Regex.scan(body, capture: :all_but_first)
    |> Enum.map(&parse_track(&1, endpoint))
    |> Enum.reject(&is_nil/1)
    |> Enum.take(@max_results)
  end

  defp parse_tracks(_body, _endpoint), do: []

  defp parse_track([item], endpoint) do
    with [audio_url] <- capture(item, ~r/class="[^"]*playlist-play[^"]*"[^>]*data-url="([^"]+)"/),
         [source_path] <-
           capture(item, ~r/href="(\/t\/[^\"]+)"[^>]*class="[^"]*playlist-down[^"]*"/),
         [duration] <- capture(item, ~r/class="playlist-duration">([^<]+)</),
         [artist] <- capture(item, ~r/class="playlist-name-artist"[^>]*>\s*<a[^>]*>(.*?)<\/a>/s),
         [title] <- capture(item, ~r/class="playlist-name-title"[^>]*>\s*<a[^>]*>(.*?)<\/a>/s),
         {:ok, track} <-
           normalize_track(%{
             artist: clean_text(artist),
             title: clean_text(title),
             duration: clean_text(duration),
             audio_url: decode_entities(audio_url),
             source_url: URI.merge(endpoint, source_path) |> URI.to_string()
           }) do
      track
    else
      _invalid -> nil
    end
  end

  defp parse_track(_item, _endpoint), do: nil

  defp capture(value, regex) do
    case Regex.run(regex, value, capture: :all_but_first) do
      captures when is_list(captures) -> captures
      _no_match -> []
    end
  end

  defp valid_track?(track) do
    valid_audio_url?(track.audio_url) and
      valid_source_url?(track.source_url) and
      track.artist != "" and track.title != "" and track.duration != ""
  end

  defp valid_audio_url?(url) do
    case URI.parse(url) do
      %URI{scheme: "https", host: host, path: "/file/" <> _} when is_binary(host) ->
        host == "sunproxy.net" or String.ends_with?(host, ".sunproxy.net")

      _invalid ->
        false
    end
  end

  defp valid_source_url?(url) do
    case URI.parse(url) do
      %URI{scheme: "https", host: host, path: "/t/" <> _}
      when host in ["mp3mn.net", "www.mp3mn.net"] ->
        true

      _invalid ->
        false
    end
  end

  defp audio_content_type(headers) do
    content_type =
      headers
      |> Map.get("content-type", [])
      |> List.first()
      |> to_string()
      |> String.downcase()
      |> String.split(";", parts: 2)
      |> List.first()

    if String.starts_with?(content_type, "audio/") or content_type == "application/octet-stream",
      do: :ok,
      else: {:error, :unsupported_content_type}
  end

  defp clean_text(value) do
    Regex.replace(~r/<[^>]*>/, value, "")
    |> decode_entities()
    |> String.trim()
  end

  defp normalize_text(value, max_length) when is_binary(value) do
    value
    |> clean_text()
    |> String.slice(0, max_length)
  end

  defp normalize_text(_value, _max_length), do: ""

  defp decode_entities(value) do
    value
    |> String.replace("&amp;", "&")
    |> String.replace("&quot;", "\"")
    |> String.replace("&#39;", "'")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> String.replace("&nbsp;", " ")
  end
end
