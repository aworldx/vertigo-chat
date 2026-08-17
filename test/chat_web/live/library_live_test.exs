# Назначение файла: LiveView-тесты публичной библиотеки, редактора и авторских прав.
defmodule ChatWeb.LibraryLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.Library
  alias Chat.Library.Article
  alias Chat.Repo
  alias ChatWeb.UserAuth

  test "shows public articles and series to every visitor", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "public_writer", "password" => "secret123"})

    {:ok, _article} =
      Library.create_article(author, %{
        "title" => "Открытая статья",
        "body" => String.duplicate("Текст для чтения. ", 30),
        "series" => "Старая полка",
        "part_number" => 1
      })

    {:ok, view, _html} = live(conn, ~p"/library")

    assert has_element?(view, "#library-page[phx-hook]")
    assert has_element?(view, "#library-articles[phx-update='stream']")
    assert has_element?(view, "[data-article-title='Открытая статья']")
    assert has_element?(view, "[data-series-name='Старая полка']")
    assert has_element?(view, "details summary")
    refute has_element?(view, "#new-library-article")
  end

  test "lets an authenticated author create and edit an article", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "live_writer", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(author)})

    assert has_element?(view, "#new-library-article")
    view |> element("#new-library-article") |> render_click()
    assert has_element?(view, "#library-article-form")

    view
    |> form("#library-article-form",
      article: %{
        title: "Первая часть",
        body: "Текст из редактора",
        series: "Live-серия",
        part_number: 1
      }
    )
    |> render_change()

    assert has_element?(view, "#article-character-count")

    view
    |> form("#library-article-form",
      article: %{
        title: "Первая часть",
        body: "Текст из редактора",
        series: "Live-серия",
        part_number: 1
      }
    )
    |> render_submit()

    assert has_element?(view, "[data-article-title='Первая часть']")
    assert [article] = Library.list_articles()

    view |> element("#edit-article-#{article.id}") |> render_click()

    view
    |> form("#library-article-form",
      article: %{title: "Исправленная часть", body: article.body}
    )
    |> render_submit()

    assert has_element?(view, "[data-article-title='Исправленная часть']")
  end

  test "does not expose editing controls to another user", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "real_author", "password" => "secret123"})

    {:ok, stranger} =
      Accounts.register_user(%{"nickname" => "reader_only", "password" => "secret123"})

    {:ok, article} =
      Library.create_article(author, %{"title" => "Защищённый текст", "body" => "Содержание"})

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(stranger)})

    refute has_element?(view, "#edit-article-#{article.id}")
    render_hook(view, "edit_article", %{"id" => article.id})
    assert render(view) =~ "Редактировать статью может только автор"
  end

  test "filters one author's series in part order", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "series_writer", "password" => "secret123"})

    {:ok, _second} =
      Library.create_article(author, %{
        "title" => "Часть 2",
        "body" => "Вторая",
        "series" => "Сага",
        "part_number" => 2
      })

    {:ok, _first} =
      Library.create_article(author, %{
        "title" => "Часть 1",
        "body" => "Первая",
        "series" => "Сага",
        "part_number" => 1
      })

    {:ok, view, _html} = live(conn, ~p"/library?author=#{author.id}&series=Сага")

    assert has_element?(view, "[data-article-title='Часть 1']")
    assert has_element?(view, "[data-article-title='Часть 2']")

    html = render(view)
    assert :binary.match(html, "Часть 1") < :binary.match(html, "Часть 2")
  end

  test "handles guest actions and invalid authentication safely", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/library?author=invalid&series=Чужая")

    render_hook(view, "authenticate_library", %{})
    render_hook(view, "new_article", %{})
    assert render(view) =~ "Войди как зарегистрированный пользователь"

    render_hook(view, "authenticate_library", %{"token" => "invalid"})
    render_hook(view, "edit_article", %{"id" => "missing"})
    assert render(view) =~ "Редактировать статью может только автор"
  end

  test "keeps invalid data in the editor and lets the author cancel", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "careful_writer", "password" => "secret123"})

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(author)})
    view |> element("#new-library-article") |> render_click()

    view
    |> form("#library-article-form", article: %{title: "", body: ""})
    |> render_submit()

    assert has_element?(view, "#library-article-form")
    assert has_element?(view, "#library-article-form .text-error")

    view |> element("#cancel-library-editor") |> render_click()
    refute has_element?(view, "#library-article-form")
  end

  test "rejects saving when the authenticated user changes during editing", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "switch_author", "password" => "secret123"})

    {:ok, stranger} =
      Accounts.register_user(%{"nickname" => "switch_reader", "password" => "secret123"})

    {:ok, article} =
      Library.create_article(author, %{"title" => "Авторский текст", "body" => "Содержание"})

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(author)})
    view |> element("#edit-article-#{article.id}") |> render_click()
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(stranger)})

    view
    |> form("#library-article-form", article: %{title: "Чужая версия", body: article.body})
    |> render_submit()

    assert render(view) =~ "Редактировать статью может только автор"
    assert {:ok, unchanged} = Library.get_article(article.id)
    assert unchanged.title == "Авторский текст"
  end

  test "formats article presentation helpers" do
    assert ChatWeb.LibraryLive.excerpt("Коротко") == "Коротко"

    long_text = String.duplicate("я", 361)
    assert String.length(ChatWeb.LibraryLive.excerpt(long_text)) == 361
    assert ChatWeb.LibraryLive.format_date(~U[2026-08-17 12:00:00Z]) == "17.08.2026"

    path = ChatWeb.LibraryLive.series_path(%{author_id: 42, name: "Старая полка"})
    assert path =~ "author=42"
    assert path =~ "series="
  end

  test "renders article input as text instead of executable HTML", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "safe_writer", "password" => "secret123"})

    {:ok, _article} =
      Library.create_article(author, %{
        "title" => "<script>alert(1)</script>",
        "body" => "<img src=x onerror=alert(1)>"
      })

    {:ok, view, _html} = live(conn, ~p"/library")

    assert has_element?(view, "article h2", "<script>alert(1)</script>")
    assert has_element?(view, "article p", "<img src=x onerror=alert(1)>")
    refute has_element?(view, "article script")
    refute has_element?(view, "article img")
  end

  test "explains the daily article quota", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "daily_library", "password" => "secret123"})

    for index <- 1..Library.max_articles_per_day() do
      assert {:ok, _article} =
               Library.create_article(author, %{
                 "title" => "Статья #{index}",
                 "body" => "Содержание"
               })
    end

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(author)})
    render_hook(view, "save_article", %{"article" => valid_article_params()})

    assert has_element?(view, "#flash-error", "За сутки можно добавить")
  end

  test "explains the total article quota", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "total_library", "password" => "secret123"})

    inserted_at = DateTime.utc_now() |> DateTime.add(-172_800) |> DateTime.truncate(:second)

    rows =
      for index <- 1..Library.max_articles_per_user() do
        %{
          user_id: author.id,
          title: "Архив #{index}",
          body: "Содержание",
          inserted_at: inserted_at,
          updated_at: inserted_at
        }
      end

    Repo.insert_all(Article, rows)

    {:ok, view, _html} = live(conn, ~p"/library")
    render_hook(view, "authenticate_library", %{"token" => UserAuth.sign(author)})
    render_hook(view, "save_article", %{"article" => valid_article_params()})

    assert has_element?(view, "#flash-error", "может хранить не больше")
  end

  defp valid_article_params, do: %{"title" => "Лишняя статья", "body" => "Содержание"}
end
