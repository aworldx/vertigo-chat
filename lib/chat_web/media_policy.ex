defmodule ChatWeb.MediaPolicy do
  @moduledoc false
  def init(opts), do: opts

  def call(conn, _opts) do
    origin =
      if Chat.Media.enabled?() do
        uri = URI.parse(Chat.Media.public_base_url())
        " " <> URI.to_string(%URI{scheme: uri.scheme, host: uri.host, port: uri.port})
      else
        ""
      end

    Phoenix.Controller.put_secure_browser_headers(conn, %{
      "content-security-policy" =>
        "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:#{origin}; media-src 'self' blob:#{origin}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:"
    })
  end
end
