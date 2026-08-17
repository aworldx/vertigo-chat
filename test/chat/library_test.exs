# Назначение файла: тесты публичных статей, авторских прав и серий библиотеки.
defmodule Chat.LibraryTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Library

  test "creates a public article and normalizes editor input" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "writer", "password" => "secret123"})

    assert {:ok, article} =
             Library.create_article(author, %{
               "title" => "  Первая статья  ",
               "body" => "  Публичный текст  ",
               "series" => "  ",
               "part_number" => "7"
             })

    assert article.title == "Первая статья"
    assert article.body == "Публичный текст"
    assert article.series == nil
    assert article.part_number == nil
    assert article.user.nickname == "writer"
    assert [listed] = Library.list_articles()
    assert listed.id == article.id
  end

  test "allows updates only by the author" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "article_owner", "password" => "secret123"})

    {:ok, stranger} =
      Accounts.register_user(%{"nickname" => "article_other", "password" => "secret123"})

    {:ok, article} = Library.create_article(author, valid_attrs("Исходник"))

    assert {:error, :forbidden} =
             Library.update_article(stranger, article, %{"title" => "Чужая правка"})

    assert {:ok, updated} = Library.update_article(author, article, %{"title" => "Новая версия"})
    assert updated.title == "Новая версия"
    assert {:error, :forbidden} = Library.create_article(nil, valid_attrs("Запрещено"))
  end

  test "groups series by author and sorts selected parts" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "serial_author", "password" => "secret123"})

    {:ok, another} =
      Accounts.register_user(%{"nickname" => "another_author", "password" => "secret123"})

    {:ok, second} = Library.create_article(author, series_attrs("Вторая", "Хроники", 2))
    {:ok, first} = Library.create_article(author, series_attrs("Первая", "Хроники", 1))
    {:ok, _other} = Library.create_article(another, series_attrs("Чужая", "Хроники", 1))

    assert Enum.map(
             Library.list_articles(author_id: author.id, series: "Хроники"),
             & &1.id
           ) == [first.id, second.id]

    assert [author_series, another_series] = Library.list_series()
    assert author_series.author_nickname == "another_author"
    assert author_series.article_count == 1
    assert another_series.author_nickname == "serial_author"
    assert another_series.article_count == 2
  end

  test "validates length and safely handles unknown article ids" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "limit_writer", "password" => "secret123"})

    attrs = valid_attrs("Слишком длинно") |> Map.put("body", String.duplicate("я", 12_001))
    assert {:error, changeset} = Library.create_article(author, attrs)
    assert %{body: [_message]} = errors_on(changeset)
    assert Library.max_body_length() == 12_000
    assert {:error, :not_found} = Library.get_article("invalid")
    assert {:error, :not_found} = Library.get_article(-1)
    assert {:error, :not_found} = Library.get_article(nil)
  end

  test "enforces the daily article quota in the context" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "article_quota", "password" => "secret123"})

    for index <- 1..Library.max_articles_per_day() do
      assert {:ok, _article} = Library.create_article(author, valid_attrs("Статья #{index}"))
    end

    assert {:error, :daily_article_limit_reached} =
             Library.create_article(author, valid_attrs("Лишняя статья"))

    assert Library.max_articles_per_user() == 50
  end

  defp valid_attrs(title), do: %{"title" => title, "body" => "Текст статьи"}

  defp series_attrs(title, series, part_number) do
    %{
      "title" => title,
      "body" => "Текст #{title}",
      "series" => series,
      "part_number" => part_number
    }
  end
end
