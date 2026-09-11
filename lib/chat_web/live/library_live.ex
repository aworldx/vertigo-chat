# Назначение файла: LiveView публичной библиотеки, серий и авторского редактора статей.
defmodule ChatWeb.LibraryLive do
  use ChatWeb, :live_view

  import Phoenix.Controller, only: [get_csrf_token: 0]

  alias Chat.Library
  alias Chat.Library.Article
  alias Chat.Ranks
  alias ChatWeb.UserAuth

  @impl true
  def mount(_params, _session, socket) do
    current_user = socket.assigns.current_account_user

    {:ok,
     socket
     |> assign(:page_title, "Библиотека")
     |> assign(:meta_description, "Библиотека Vertigo: книги и обсуждения для чатланов.")
     |> assign(:canonical_path, ~p"/library")
     |> assign(:current_user, current_user)
     |> assign(:can_add_library_articles?, Ranks.can_add_library_articles?(current_user))
     |> assign(:auth_checked?, true)
     |> assign(:selected_series, nil)
     |> assign(:selected_author_id, nil)
     |> assign(:series, Library.list_series())
     |> assign(:editor_open?, false)
     |> assign(:editing_article, nil)
     |> assign(:article_form, nil)
     |> assign(:body_length, 0)
     |> assign(:max_body_length, Library.max_body_length())
     |> stream(:articles, [])}
  end

  @impl true
  def handle_params(params, _uri, socket) do
    author_id = parse_author_id(params["author"])
    series = normalize_series(params["series"], author_id)
    articles = Library.list_articles(author_id: author_id, series: series)

    {:noreply,
     socket
     |> assign(:selected_series, series)
     |> assign(:selected_author_id, author_id)
     |> assign(:series, Library.list_series())
     |> stream(:articles, articles, reset: true)}
  end

  @impl true
  def handle_event("authenticate_library", %{"token" => token}, socket) do
    case UserAuth.verify(token) do
      {:ok, user} ->
        {:noreply,
         socket
         |> assign(:current_user, user)
         |> assign(:can_add_library_articles?, Ranks.can_add_library_articles?(user))
         |> assign(:auth_checked?, true)
         |> refresh_articles()}

      {:error, :invalid_token} ->
        {:noreply,
         socket
         |> assign(:current_user, nil)
         |> assign(:can_add_library_articles?, false)
         |> assign(:auth_checked?, true)
         |> refresh_articles()}
    end
  end

  def handle_event("authenticate_library", _params, socket) do
    {:noreply,
     socket
     |> assign(:current_user, nil)
     |> assign(:can_add_library_articles?, false)
     |> assign(:auth_checked?, true)
     |> refresh_articles()}
  end

  def handle_event(
        "new_article",
        _params,
        %{assigns: %{current_user: %{}, can_add_library_articles?: true}} = socket
      ) do
    article = %Article{}

    {:noreply,
     socket
     |> assign(:editor_open?, true)
     |> assign(:editing_article, nil)
     |> assign(:article_form, to_form(Library.change_article(article)))
     |> assign(:body_length, 0)}
  end

  def handle_event("new_article", _params, socket) do
    {:noreply, put_flash(socket, :error, "Добавлять статьи могут чатлане со званием «Киноман».")}
  end

  def handle_event("edit_article", %{"id" => id}, socket) do
    with %{} = user <- socket.assigns.current_user,
         {:ok, article} <- Library.get_article(id),
         true <- article.user_id == user.id do
      {:noreply,
       socket
       |> assign(:editor_open?, true)
       |> assign(:editing_article, article)
       |> assign(:article_form, to_form(Library.change_article(article)))
       |> assign(:body_length, String.length(article.body))}
    else
      _reason -> {:noreply, put_flash(socket, :error, "Редактировать статью может только автор.")}
    end
  end

  def handle_event("validate_article", %{"article" => params}, socket) do
    form =
      socket
      |> editor_article()
      |> Library.change_article(params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply,
     socket
     |> assign(:article_form, form)
     |> assign(:body_length, params |> Map.get("body", "") |> String.length())}
  end

  def handle_event("save_article", %{"article" => params}, socket) do
    result =
      case socket.assigns.editing_article do
        %Article{} = article ->
          Library.update_article(socket.assigns.current_user, article, params)

        nil ->
          Library.create_article(socket.assigns.current_user, params)
      end

    case result do
      {:ok, _article} ->
        {:noreply,
         socket
         |> close_editor()
         |> assign(:series, Library.list_series())
         |> stream(:articles, current_articles(socket), reset: true)
         |> put_flash(:info, "Статья сохранена.")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply,
         socket
         |> assign(:article_form, to_form(changeset))
         |> assign(:body_length, params |> Map.get("body", "") |> String.length())}

      {:error, :forbidden} ->
        {:noreply, put_flash(socket, :error, "Редактировать статью может только автор.")}

      {:error, :kinoman_required} ->
        {:noreply,
         put_flash(socket, :error, "Добавлять статьи могут чатлане со званием «Киноман».")}

      {:error, :daily_article_limit_reached} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "За сутки можно добавить не больше #{Library.max_articles_per_day()} статей."
         )}

      {:error, :article_limit_reached} ->
        {:noreply,
         put_flash(
           socket,
           :error,
           "Один автор может хранить не больше #{Library.max_articles_per_user()} статей."
         )}
    end
  end

  def handle_event("cancel_editor", _params, socket), do: {:noreply, close_editor(socket)}

  def excerpt(body) do
    if String.length(body) > 360, do: String.slice(body, 0, 360) <> "…", else: body
  end

  def format_date(datetime), do: Calendar.strftime(datetime, "%d.%m.%Y")

  def series_path(series) do
    ~p"/library?#{%{author: series.author_id, series: series.name}}"
  end

  defp current_articles(socket) do
    Library.list_articles(
      author_id: socket.assigns.selected_author_id,
      series: socket.assigns.selected_series
    )
  end

  defp refresh_articles(socket) do
    stream(socket, :articles, current_articles(socket), reset: true)
  end

  defp editor_article(%{assigns: %{editing_article: %Article{} = article}}), do: article
  defp editor_article(_socket), do: %Article{}

  defp close_editor(socket) do
    socket
    |> assign(:editor_open?, false)
    |> assign(:editing_article, nil)
    |> assign(:article_form, nil)
    |> assign(:body_length, 0)
  end

  defp parse_author_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed, ""} when parsed > 0 -> parsed
      _invalid -> nil
    end
  end

  defp parse_author_id(_id), do: nil

  defp normalize_series(series, author_id) when is_binary(series) and is_integer(author_id) do
    case String.trim(series) do
      "" -> nil
      normalized -> normalized
    end
  end

  defp normalize_series(_series, _author_id), do: nil
end
