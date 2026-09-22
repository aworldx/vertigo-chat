# Назначение файла: подписывает ответы DiscourseConnect, сохраняя чат источником учётных записей.
defmodule Chat.Forum do
  alias Chat.Accounts.User

  @type sso_response :: %{return_url: String.t(), sso: String.t(), sig: String.t()}

  def discourse_connect_response(%User{} = user, params, avatar_url \\ nil) when is_map(params) do
    with {:ok, secret} <- discourse_connect_secret(),
         {:ok, request} <- verify_request(params, secret),
         {:ok, email} <- forum_email(user.email) do
      response =
        %{
          "nonce" => request["nonce"],
          "external_id" => Integer.to_string(user.id),
          "username" => user.nickname,
          "email" => email,
          # The chat does not send mail itself. Discourse must verify this address before use.
          "require_activation" => "true"
        }
        |> maybe_put("avatar_url", avatar_url)

      encoded_response = response |> URI.encode_query() |> Base.encode64()

      {:ok,
       %{
         return_url: request["return_sso_url"],
         sso: encoded_response,
         sig: signature(encoded_response, secret)
       }}
    end
  end

  defp discourse_connect_secret do
    case Application.get_env(:chat, __MODULE__, [])[:discourse_connect_secret] do
      secret when is_binary(secret) and byte_size(secret) >= 32 -> {:ok, secret}
      _ -> {:error, :not_configured}
    end
  end

  defp verify_request(%{"sso" => encoded, "sig" => given_signature}, secret)
       when is_binary(encoded) and is_binary(given_signature) do
    with true <- valid_signature?(encoded, given_signature, secret),
         {:ok, payload} <- Base.decode64(encoded),
         request <- URI.decode_query(payload),
         true <- valid_request?(request) do
      {:ok, request}
    else
      _ -> {:error, :invalid_request}
    end
  end

  defp verify_request(_params, _secret), do: {:error, :invalid_request}

  defp valid_signature?(payload, given_signature, secret) when byte_size(given_signature) == 64 do
    Plug.Crypto.secure_compare(signature(payload, secret), String.downcase(given_signature))
  end

  defp valid_signature?(_payload, _given_signature, _secret), do: false

  defp valid_request?(%{"nonce" => nonce, "return_sso_url" => return_url})
       when byte_size(nonce) > 0 and is_binary(return_url) do
    case URI.parse(return_url) do
      %URI{scheme: scheme, host: host} when scheme in ["http", "https"] and is_binary(host) ->
        true

      _ ->
        false
    end
  end

  defp valid_request?(_request), do: false

  defp forum_email(email) when is_binary(email) do
    if String.trim(email) == "", do: {:error, :email_required}, else: {:ok, email}
  end

  defp forum_email(_email), do: {:error, :email_required}

  defp signature(payload, secret),
    do: :crypto.mac(:hmac, :sha256, secret, payload) |> Base.encode16(case: :lower)

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
