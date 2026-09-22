defmodule Chat.Gifs do
  @moduledoc "Searches GifSnap's public GIF catalogue for chat sharing."

  @endpoint "https://gifsnap.com/api/v1/gifs/search"
  @max_results 12
  @max_query_length 80

  @type gif :: %{
          id: String.t(),
          title: String.t(),
          url: String.t(),
          preview_url: String.t(),
          width: pos_integer() | nil,
          height: pos_integer() | nil
        }

  @spec search(String.t()) :: {:ok, [gif()]} | {:error, atom()}
  def search(query) when is_binary(query) do
    query = String.trim(query)

    cond do
      query == "" -> {:error, :query_required}
      String.length(query) > @max_query_length -> {:error, :query_too_long}
      true -> fetch_results(query)
    end
  end

  def search(_query), do: {:error, :query_required}

  @spec valid_media_url?(String.t()) :: boolean()
  def valid_media_url?(url) when is_binary(url) do
    case URI.parse(url) do
      %URI{scheme: "https", host: "gifsnap.com", path: "/api/v1/media/" <> _} ->
        true

      %URI{scheme: "https", host: "static.klipy.com", path: path} when is_binary(path) ->
        String.ends_with?(path, [".gif", ".webp"])

      %URI{scheme: "https", host: host, path: "/gifs/" <> path}
      when is_binary(host) and is_binary(path) ->
        trusted_r2_host?(host) and String.ends_with?(path, [".gif", ".webp"])

      %URI{scheme: "https", host: host, path: "/thumbnails/" <> path}
      when is_binary(host) and is_binary(path) ->
        trusted_r2_host?(host) and String.ends_with?(path, [".gif", ".webp"])

      _invalid ->
        false
    end
  end

  def valid_media_url?(_url), do: false

  @spec proxy_url(String.t()) :: String.t()
  def proxy_url(url) when is_binary(url) do
    "/gif-proxy?" <> URI.encode_query(%{"url" => url})
  end

  @spec fetch_media(String.t()) :: {:ok, binary(), String.t()} | {:error, atom()}
  def fetch_media(url) when is_binary(url) do
    config = Application.get_env(:chat, __MODULE__, [])

    options = [
      headers: [{"accept", "image/gif,image/webp,image/*;q=0.8"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 10_000),
      retry: Keyword.get(config, :retry, :transient)
    ]

    options = if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options

    with true <- valid_media_url?(url),
         {:ok, response} <- Req.get(url, options),
         true <- response.status in 200..299,
         {:ok, content_type} <- image_content_type(response.headers),
         true <- is_binary(response.body) do
      {:ok, response.body, content_type}
    else
      false -> {:error, :media_unavailable}
      {:error, _reason} -> {:error, :media_unavailable}
      _unexpected -> {:error, :media_unavailable}
    end
  end

  def fetch_media(_url), do: {:error, :media_unavailable}

  defp fetch_results(query) do
    config = Application.get_env(:chat, __MODULE__, [])

    with {:ok, response} <-
           Req.get(config[:endpoint] || @endpoint, request_options(config, query)),
         true <- response.status in 200..299,
         {:ok, results} <- decode_results(response.body) do
      gifs = results |> Enum.map(&to_gif/1) |> Enum.reject(&is_nil/1)
      if gifs == [], do: {:error, :not_found}, else: {:ok, gifs}
    else
      false -> {:error, :provider_unavailable}
      {:error, _reason} -> {:error, :provider_unavailable}
      _unexpected -> {:error, :provider_unavailable}
    end
  end

  defp request_options(config, query) do
    options = [
      params: [q: query, page: 1, limit: @max_results],
      headers: [{"user-agent", "VertigoChat/1.0"}],
      receive_timeout: Keyword.get(config, :receive_timeout, 10_000),
      retry: Keyword.get(config, :retry, :transient)
    ]

    if config[:plug], do: Keyword.put(options, :plug, config[:plug]), else: options
  end

  defp decode_results(%{"data" => results}) when is_list(results), do: {:ok, results}

  defp decode_results(body) when is_binary(body) do
    with {:ok, %{"data" => results}} when is_list(results) <- Jason.decode(body) do
      {:ok, results}
    end
  end

  defp decode_results(_body), do: {:error, :invalid_response}

  defp to_gif(%{"id" => id, "url" => url, "preview_url" => preview_url} = result)
       when is_binary(id) and is_binary(url) and is_binary(preview_url) do
    if valid_media_url?(url) and valid_media_url?(preview_url) do
      %{
        id: id,
        title: normalize_title(result["title"]),
        url: url,
        preview_url: preview_url,
        width: positive_integer(result["width"]),
        height: positive_integer(result["height"])
      }
    end
  end

  defp to_gif(_result), do: nil

  defp normalize_title(title) when is_binary(title) do
    case title |> String.trim() |> String.slice(0, 160) do
      "" -> "GIF"
      value -> value
    end
  end

  defp normalize_title(_title), do: "GIF"

  defp positive_integer(value) when is_integer(value) and value > 0, do: value
  defp positive_integer(_value), do: nil

  defp trusted_r2_host?(host) do
    String.starts_with?(host, "pub-") and String.ends_with?(host, ".r2.dev")
  end

  defp image_content_type(headers) do
    content_type =
      headers
      |> Map.get("content-type", [])
      |> List.first()
      |> to_string()
      |> String.downcase()
      |> String.split(";", parts: 2)
      |> List.first()

    if content_type in ["image/gif", "image/webp"],
      do: {:ok, content_type},
      else: {:error, :unsupported_content_type}
  end
end
