defmodule ChatWeb.MediaPolicy do
  @moduledoc false
  def init(opts), do: opts

  def call(conn, _opts) do
    {media_origin, upload_origin} =
      if Chat.Media.enabled?() do
        {origin(Chat.Media.public_base_url()), origin(Chat.Media.upload_origin())}
      else
        {"", ""}
      end

    youtube_worker_origin =
      Application.get_env(:chat, Chat.YouTube, [])
      |> Keyword.get(:proxy_base_url)
      |> origin()

    Phoenix.Controller.put_secure_browser_headers(conn, %{
      "content-security-policy" =>
        "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:#{media_origin}; media-src 'self' blob:#{media_origin}#{youtube_worker_origin}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:#{upload_origin}"
    })
  end

  defp origin(nil), do: ""

  defp origin(url) do
    uri = URI.parse(url)
    " " <> URI.to_string(%URI{scheme: uri.scheme, host: uri.host, port: uri.port})
  end
end
