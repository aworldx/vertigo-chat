# Назначение файла: динамические правила индексации с адресом карты сайта текущего домена.
defmodule ChatWeb.RobotsController do
  use ChatWeb, :controller

  def show(conn, _params) do
    sitemap_url = ChatWeb.Endpoint.url() <> ~p"/sitemap.xml"

    body = """
    User-agent: *
    Disallow: /admin
    Disallow: /visits
    Disallow: /profiles
    Disallow: /gallery
    Sitemap: #{sitemap_url}
    """

    conn
    |> put_resp_content_type("text/plain", "utf-8")
    |> send_resp(200, body)
  end
end
