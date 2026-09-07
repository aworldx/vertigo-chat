# Назначение файла: XML-карта публичных страниц, полезных для поиска.
defmodule ChatWeb.SitemapController do
  use ChatWeb, :controller

  @paths [
    "/about",
    "/articles",
    "/articles/chats-vs-messengers",
    "/articles/chat-platforms-russia",
    "/articles/how-vertigo-chat-works",
    "/games",
    "/games/battleship",
    "/games/durak",
    "/games/balda",
    "/checkers",
    "/library",
    "/help"
  ]

  def show(conn, _params) do
    urls = Enum.map_join(@paths, "\n", &sitemap_entry(ChatWeb.Endpoint.url() <> &1))

    body = """
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    #{urls}
    </urlset>
    """

    conn
    |> put_resp_content_type("application/xml", "utf-8")
    |> send_resp(200, body)
  end

  defp sitemap_entry(url), do: "  <url><loc>#{url}</loc></url>"
end
