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

  def presigned_put_url(key, content_type) do
    config = Media.config()
    url = object_url(key)

    Req.Utils.aws_sigv4_url(
      access_key_id: Keyword.fetch!(config, :access_key_id),
      secret_access_key: Keyword.fetch!(config, :secret_access_key),
      region: Keyword.fetch!(config, :region),
      service: :s3,
      datetime: DateTime.utc_now(),
      method: :put,
      url: url,
      expires: 300,
      headers: [{"content-type", content_type}]
    )
    |> URI.to_string()
  end

  def get(key) do
    case request(:get, key, []) do
      {:ok, %{status: 200, body: bytes}} -> {:ok, bytes}
      _ -> {:error, :storage_unavailable}
    end
  end

  def delete(key) do
    case request(:delete, key, []) do
      {:ok, %{status: status}} when status in 200..299 -> :ok
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

    url = object_url(key)

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

  defp object_url(key) do
    config = Media.config()
    endpoint = String.trim_trailing(Keyword.fetch!(config, :endpoint), "/")

    base_url =
      if config[:virtual_hosted] do
        uri = URI.parse(endpoint)
        %{uri | host: "#{Keyword.fetch!(config, :bucket)}.#{uri.host}"} |> URI.to_string()
      else
        endpoint <> "/" <> Keyword.fetch!(config, :bucket)
      end

    base_url <> "/" <> Media.encode_key(key)
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
