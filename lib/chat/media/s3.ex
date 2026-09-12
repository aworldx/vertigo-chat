defmodule Chat.Media.S3 do
  @moduledoc false

  alias Chat.Media

  def put(key, bytes, content_type) do
    options = [
      body: bytes,
      headers: [
        {"content-type", content_type},
        {"cache-control", "public, max-age=31536000, immutable"}
      ]
    ]

    with {:ok, %{status: status}} when status in 200..299 <- request(:put, key, options),
         :ok <- verify(key, bytes) do
      :ok
    else
      _ -> {:error, :storage_unavailable}
    end
  end

  # Verify anonymous reads and exact bytes before removing the database copy.
  def verify(key, bytes) do
    opts = Keyword.merge(request_options(), method: :get, url: Media.public_url(key))

    case Req.request(opts) do
      {:ok, %{status: 200, body: ^bytes}} -> :ok
      _ -> {:error, :verification_failed}
    end
  end

  defp request(method, key, options) do
    config = Media.config()

    url =
      String.trim_trailing(Keyword.fetch!(config, :endpoint), "/") <>
        "/" <> Keyword.fetch!(config, :bucket) <> "/" <> Media.encode_key(key)

    request_options()
    |> Keyword.merge(options)
    |> Keyword.merge(
      method: method,
      url: url,
      aws_sigv4: [
        service: :s3,
        region: Keyword.fetch!(config, :region),
        access_key_id: Keyword.fetch!(config, :access_key_id),
        secret_access_key: Keyword.fetch!(config, :secret_access_key)
      ]
    )
    |> Req.request()
  end

  defp request_options do
    [
      decode_body: false,
      compressed: false,
      redirect: false,
      retry: false,
      receive_timeout: 30_000
    ]
    |> Keyword.merge(Media.config()[:request_options] || [])
  end
end
