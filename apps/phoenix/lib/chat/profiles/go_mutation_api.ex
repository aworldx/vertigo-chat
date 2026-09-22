# Назначение файла: переходной клиент Go mutation API для единственного владельца записи анкет.
defmodule Chat.Profiles.GoMutationAPI do
  @moduledoc false

  def enabled? do
    is_binary(base_url()) and is_binary(token()) and token() != ""
  end

  def update(user_id, attrs) when is_integer(user_id) and is_map(attrs) do
    request(
      :patch,
      "/internal/v1/profiles/#{user_id}",
      Jason.encode!(%{profile: attrs}),
      "application/json"
    )
  end

  def put_photo(user_id, bytes, content_type)
      when is_integer(user_id) and is_binary(bytes) and is_binary(content_type) do
    boundary = "----chat-profile-" <> Base.encode16(:crypto.strong_rand_bytes(12), case: :lower)

    body = [
      "--",
      boundary,
      "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"profile\"\r\nContent-Type: ",
      content_type,
      "\r\n\r\n",
      bytes,
      "\r\n--",
      boundary,
      "--\r\n"
    ]

    request(
      :put,
      "/internal/v1/profiles/#{user_id}/photo",
      body,
      "multipart/form-data; boundary=#{boundary}"
    )
  end

  defp request(method, path, body, content_type) do
    case Req.request(
           method: method,
           url: base_url() <> path,
           body: body,
           headers: [{"content-type", content_type}, {"x-internal-profile-token", token()}],
           retry: false,
           receive_timeout: 30_000
         ) do
      {:ok, %Req.Response{status: status}} when status in 200..299 -> :ok
      {:ok, %Req.Response{status: 422}} -> {:error, :invalid}
      {:ok, %Req.Response{status: 404}} -> {:error, :not_found}
      _ -> {:error, :unavailable}
    end
  end

  defp base_url do
    config(:base_url)
    |> case do
      value when is_binary(value) and value != "" -> String.trim_trailing(value, "/")
      _ -> nil
    end
  end

  defp token, do: config(:token)
  defp config(key), do: Application.get_env(:chat, __MODULE__, []) |> Keyword.get(key)
end
