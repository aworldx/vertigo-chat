# Назначение файла: каталог анкет с серверным поиском и пагинацией.
defmodule ChatWeb.ProfilesLive do
  use ChatWeb, :live_view

  alias Chat.Profiles
  alias ChatWeb.Media

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, "Анкеты")
     |> assign(:search, "")
     |> assign(:search_form, to_form(%{"query" => ""}, as: :search))
     |> assign(:page, 1)
     |> assign(:total, 0)
     |> assign(:total_pages, 1)
     |> assign(:pages, [1])
     |> assign(:selected_profile, nil)
     |> stream(:profiles, [])}
  end

  @impl true
  def handle_params(params, _uri, socket) do
    search = params["q"] || ""
    result = Profiles.list_profiles(search: search, page: params["page"] || 1)

    {:noreply,
     socket
     |> assign(:search, search)
     |> assign(:search_form, to_form(%{"query" => search}, as: :search))
     |> assign(:page, result.page)
     |> assign(:total, result.total)
     |> assign(:total_pages, result.total_pages)
     |> assign(:pages, visible_pages(result.page, result.total_pages))
     |> stream(:profiles, result.profiles, reset: true)}
  end

  @impl true
  def handle_event("search", %{"search" => %{"query" => query}}, socket) do
    query = String.trim(query)
    {:noreply, push_patch(socket, to: ~p"/profiles?#{%{q: query}}")}
  end

  def handle_event("open_profile", %{"nickname" => nickname}, socket) do
    case Profiles.get_by_nickname(nickname) do
      {:ok, profile} -> {:noreply, assign(socket, :selected_profile, profile)}
      {:error, :not_found} -> {:noreply, put_flash(socket, :error, "Анкета не найдена.")}
    end
  end

  def handle_event("close_profile", _params, socket) do
    {:noreply, assign(socket, :selected_profile, nil)}
  end

  def photo_url(profile), do: Media.data_url(profile.photo, profile.photo_content_type)

  def gender_label("male"), do: "Мужской"
  def gender_label("female"), do: "Женский"
  def gender_label("other"), do: "Другой"
  def gender_label(_gender), do: "Не указан"

  defp visible_pages(page, total_pages) do
    first = max(page - 2, 1)
    last = min(first + 4, total_pages)
    first = max(last - 4, 1)
    Enum.to_list(first..last)
  end
end
