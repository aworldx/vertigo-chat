# Назначение файла: контекст публичной библиотеки, авторства и серий статей.
defmodule Chat.Library do
  @moduledoc "Публичные тексты чатлан с защищённым авторским редактированием."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Library.Article
  alias Chat.Ranks
  alias Chat.Repo

  @max_articles_per_user 50
  @max_articles_per_day 10

  def list_articles(opts \\ []) do
    author_id = Keyword.get(opts, :author_id)
    series = normalize_series(Keyword.get(opts, :series))

    Article
    |> maybe_filter_series(author_id, series)
    |> order_articles(series)
    |> preload(:user)
    |> Repo.all()
  end

  def list_series do
    from(article in Article,
      join: user in assoc(article, :user),
      where: not is_nil(article.series),
      group_by: [article.user_id, user.nickname, article.series],
      order_by: [asc: user.nickname, asc: article.series],
      select: %{
        author_id: article.user_id,
        author_nickname: user.nickname,
        name: article.series,
        article_count: count(article.id)
      }
    )
    |> Repo.all()
  end

  def get_article(id) when is_integer(id) do
    Article
    |> Repo.get(id)
    |> Repo.preload(:user)
    |> case do
      nil -> {:error, :not_found}
      article -> {:ok, article}
    end
  end

  def get_article(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed_id, ""} -> get_article(parsed_id)
      _invalid -> {:error, :not_found}
    end
  end

  def get_article(_id), do: {:error, :not_found}

  def change_article(%Article{} = article, attrs \\ %{}) do
    Article.changeset(article, attrs)
  end

  def create_article(%User{} = user, attrs) do
    Repo.transaction(fn ->
      user = lock_user!(user.id)

      total = Repo.aggregate(from(article in Article, where: article.user_id == ^user.id), :count)

      daily =
        Repo.aggregate(
          from(article in Article,
            where:
              article.user_id == ^user.id and
                article.inserted_at >= ago(1, "day")
          ),
          :count
        )

      cond do
        not Ranks.can_add_library_articles?(user) ->
          Repo.rollback(:kinoman_required)

        total >= @max_articles_per_user ->
          Repo.rollback(:article_limit_reached)

        daily >= @max_articles_per_day ->
          Repo.rollback(:daily_article_limit_reached)

        true ->
          case %Article{user_id: user.id} |> Article.changeset(attrs) |> Repo.insert() do
            {:ok, article} -> article
            {:error, changeset} -> Repo.rollback(changeset)
          end
      end
    end)
    |> preload_result()
  end

  def create_article(_user, _attrs), do: {:error, :forbidden}

  def update_article(%User{id: user_id}, %Article{user_id: user_id} = article, attrs) do
    article
    |> Article.changeset(attrs)
    |> Repo.update()
    |> preload_result()
  end

  def update_article(_user, _article, _attrs), do: {:error, :forbidden}

  def max_body_length, do: Article.max_body_length()
  def max_articles_per_user, do: @max_articles_per_user
  def max_articles_per_day, do: @max_articles_per_day

  defp maybe_filter_series(query, author_id, series)
       when is_integer(author_id) and is_binary(series) do
    where(query, [article], article.user_id == ^author_id and article.series == ^series)
  end

  defp maybe_filter_series(query, _author_id, _series), do: query

  defp order_articles(query, series) when is_binary(series) do
    order_by(query, [article],
      asc_nulls_last: article.part_number,
      asc: article.inserted_at,
      asc: article.id
    )
  end

  defp order_articles(query, _series) do
    order_by(query, [article], desc: article.inserted_at, desc: article.id)
  end

  defp normalize_series(series) when is_binary(series) do
    case String.trim(series) do
      "" -> nil
      normalized -> normalized
    end
  end

  defp normalize_series(_series), do: nil

  defp preload_result({:ok, article}), do: {:ok, Repo.preload(article, :user)}
  defp preload_result(error), do: error

  defp lock_user!(user_id) do
    Repo.one!(from(user in User, where: user.id == ^user_id, lock: "FOR UPDATE"))
  end
end
