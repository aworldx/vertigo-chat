# Назначение файла: переходной BFF-адаптер Go Accounts для проверки credentials.
defmodule Chat.Accounts.GoAPI do
  @moduledoc false

  def enabled?, do: is_binary(base_url()) and is_binary(token()) and token() != ""

  def authenticate(nickname, password) when is_binary(nickname) and is_binary(password) do
    request(:post, "/internal/v1/accounts/authenticate", %{nickname: nickname, password: password})
  end

  def principal(user_id) when is_integer(user_id) and user_id > 0 do
    request(:get, "/internal/v1/accounts/#{user_id}/principal", nil)
  end

  def has_role?(user_id, role)
      when is_integer(user_id) and role in ["admin", "emoji_moderator"] do
    case request_raw(:get, "/internal/v1/accounts/#{user_id}/principal", nil) do
      {:ok, %{"data" => %{"roles" => roles}}} when is_list(roles) -> role in roles
      _ -> false
    end
  end

  def register(attrs) when is_map(attrs) do
    request(:post, "/internal/v1/accounts/register", %{
      nickname: Map.get(attrs, "nickname", ""),
      email: Map.get(attrs, "email", ""),
      password: Map.get(attrs, "password", "")
    })
  end

  defp request(method, path, body) do
    case request_raw(method, path, body) do
      {:ok, %{"data" => %{"user_id" => user_id}}} when is_integer(user_id) and user_id > 0 ->
        {:ok, user_id}

      {:error, reason} ->
        {:error, reason}

      _ ->
        {:error, :unavailable}
    end
  end

  defp request_raw(method, path, body) do
    options = [
      method: method,
      url: base_url() <> path,
      headers: [{"x-internal-accounts-token", token()}],
      retry: false,
      receive_timeout: 5_000
    ]

    options = if is_nil(body), do: options, else: Keyword.put(options, :json, body)

    case Req.request(options) do
      {:ok, %Req.Response{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %Req.Response{status: status}} when status in [401, 422] ->
        {:error, :invalid_credentials}

      _ ->
        {:error, :unavailable}
    end
  end

  defp base_url do
    case config(:base_url) do
      value when is_binary(value) and value != "" -> String.trim_trailing(value, "/")
      _ -> nil
    end
  end

  defp token, do: config(:token)
  defp config(key), do: Application.get_env(:chat, __MODULE__, []) |> Keyword.get(key)
end
