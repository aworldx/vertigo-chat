# Назначение файла: переходной read-адаптер публичного Go API анкет.
defmodule Chat.Profiles.GoAPI do
  @moduledoc false

  def enabled? do
    is_binary(base_url())
  end

  def list(query_string) when is_binary(query_string) do
    request("/api/v1/profiles?" <> query_string)
  end

  def get(nickname) when is_binary(nickname) do
    request("/api/v1/profiles/" <> URI.encode(nickname, &URI.char_unreserved?/1))
  end

  def photo(nickname, thumbnail? \\ false) when is_binary(nickname) and is_boolean(thumbnail?) do
    suffix = if thumbnail?, do: "/photo/thumbnail", else: "/photo"
    request_media("/api/v1/profiles/" <> URI.encode(nickname, &URI.char_unreserved?/1) <> suffix)
  end

  defp request(path) do
    case Req.get(base_url() <> path) do
      {:ok, %Req.Response{status: status, body: body}} when is_integer(status) and is_map(body) ->
        {:ok, status, body}

      _ ->
        {:error, :unavailable}
    end
  end

  defp request_media(path) do
    case Req.get(base_url() <> path, retry: false, receive_timeout: 30_000) do
      {:ok, %Req.Response{status: status, body: body, headers: headers}}
      when is_integer(status) and is_binary(body) ->
        {:ok, status, body, content_type(headers)}

      _ ->
        {:error, :unavailable}
    end
  end

  defp content_type(headers) do
    headers
    |> Map.get("content-type", ["application/octet-stream"])
    |> List.first()
  end

  defp base_url do
    :chat
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:base_url)
    |> case do
      value when is_binary(value) ->
        case String.trim_trailing(value, "/") do
          "" -> nil
          normalized -> normalized
        end

      _ ->
        nil
    end
  end
end
