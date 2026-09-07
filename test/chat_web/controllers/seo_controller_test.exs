# Назначение файла: проверки публичных SEO-файлов и посадочной страницы.
defmodule ChatWeb.SeoControllerTest do
  use ChatWeb.ConnCase, async: true

  test "serves robots with the current sitemap URL", %{conn: conn} do
    conn = get(conn, "/robots.txt")
    sitemap_url = ChatWeb.Endpoint.url() <> "/sitemap.xml"

    assert response(conn, 200) =~ "User-agent: *"
    assert response(conn, 200) =~ "Sitemap: #{sitemap_url}"
    assert get_resp_header(conn, "content-type") == ["text/plain; charset=utf-8"]
  end

  test "serves a sitemap containing public pages only", %{conn: conn} do
    conn = get(conn, "/sitemap.xml")
    body = response(conn, 200)
    about_url = ChatWeb.Endpoint.url() <> "/about"
    games_url = ChatWeb.Endpoint.url() <> "/games"
    articles_url = ChatWeb.Endpoint.url() <> "/articles"
    article_url = ChatWeb.Endpoint.url() <> "/articles/chats-vs-messengers"
    history_url = ChatWeb.Endpoint.url() <> "/articles/chat-platforms-russia"
    technology_url = ChatWeb.Endpoint.url() <> "/articles/how-vertigo-chat-works"

    assert body =~ "<loc>#{about_url}</loc>"
    assert body =~ "<loc>#{games_url}</loc>"
    assert body =~ "<loc>#{articles_url}</loc>"
    assert body =~ "<loc>#{article_url}</loc>"
    assert body =~ "<loc>#{history_url}</loc>"
    assert body =~ "<loc>#{technology_url}</loc>"
    refute body =~ "/admin"
    refute body =~ "/profiles"
    assert get_resp_header(conn, "content-type") == ["application/xml; charset=utf-8"]
  end

  test "renders the public landing page with SEO metadata", %{conn: conn} do
    {:ok, view, html} = live(conn, "/about")
    canonical_url = ChatWeb.Endpoint.url() <> "/about"

    assert has_element?(view, "#vertigo-landing h1", "Общайся, знакомься и играй вместе")
    assert has_element?(view, "#landing-enter-chat[href='/']", "Перейти в чат")
    assert html =~ "<meta name=\"description\""
    assert html =~ "русскоязычный чат"
    assert html =~ "<link rel=\"canonical\" href=\"#{canonical_url}\""
  end

  test "renders an indexable article with a canonical URL", %{conn: conn} do
    {:ok, view, html} = live(conn, "/articles/chats-vs-messengers")
    canonical_url = ChatWeb.Endpoint.url() <> "/articles/chats-vs-messengers"

    assert has_element?(view, "#article-chats-vs-messengers h1", "Зачем нужны чаты")
    assert has_element?(view, "#article-enter-chat[href='/']", "Перейти в чат")
    assert html =~ "<meta property=\"og:type\" content=\"article\""
    assert html =~ "<link rel=\"canonical\" href=\"#{canonical_url}\""
  end

  test "renders the history article with a canonical URL", %{conn: conn} do
    {:ok, view, html} = live(conn, "/articles/chat-platforms-russia")
    canonical_url = ChatWeb.Endpoint.url() <> "/articles/chat-platforms-russia"

    assert has_element?(view, "#article-chat-platforms-russia h1", "От «Кроватки» до Telegram")
    assert has_element?(view, "#history-enter-chat[href='/']", "Перейти в чат")
    assert html =~ "<link rel=\"canonical\" href=\"#{canonical_url}\""
  end

  test "renders the technology article with a canonical URL", %{conn: conn} do
    {:ok, view, html} = live(conn, "/articles/how-vertigo-chat-works")
    canonical_url = ChatWeb.Endpoint.url() <> "/articles/how-vertigo-chat-works"

    assert has_element?(view, "#article-how-vertigo-chat-works h1", "Как устроен Vertigo")
    assert has_element?(view, "#technology-enter-chat[href='/']", "Перейти в чат")
    assert html =~ "<link rel=\"canonical\" href=\"#{canonical_url}\""
  end
end
