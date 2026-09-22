# Назначение файла: контекст анкет пользователей и правил их редактирования.
defmodule Chat.Profiles do
  @moduledoc "Анкеты зарегистрированных пользователей."

  alias Chat.Accounts.User
  alias Chat.Profiles.GoMutationAPI
  alias Chat.Profiles.Profile
  alias Chat.Repo
  alias Chat.Uploads

  import Ecto.Query

  @default_page_size 12

  def get_by_nickname(nickname) when is_binary(nickname) do
    query =
      from profile in Profile,
        join: user in assoc(profile, :user),
        where: user.nickname == ^nickname,
        preload: [user: user]

    case Repo.one(query) do
      nil -> {:error, :not_found}
      profile -> {:ok, profile}
    end
  end

  def change_profile(%Profile{} = profile, attrs \\ %{}) do
    Profile.changeset(profile, attrs)
  end

  def guest_profile(nickname) when is_binary(nickname) do
    %Profile{user: %User{nickname: nickname}}
  end

  def list_profiles(opts \\ []) do
    search = opts |> Keyword.get(:search, "") |> normalize_search()
    requested_page = opts |> Keyword.get(:page, 1) |> normalize_page()
    page_size = opts |> Keyword.get(:page_size, @default_page_size) |> normalize_page_size()

    query =
      from profile in Profile,
        join: user in assoc(profile, :user)

    query =
      if search == "" do
        query
      else
        pattern = "%#{search}%"

        from [profile, user] in query,
          where: ilike(user.nickname, ^pattern) or ilike(profile.name, ^pattern)
      end

    total = Repo.aggregate(query, :count, :id)
    total_pages = max(ceil(total / page_size), 1)
    page = min(requested_page, total_pages)

    profiles =
      query
      |> order_by([_profile, user], asc: user.nickname)
      |> limit(^page_size)
      |> offset(^((page - 1) * page_size))
      |> preload([_profile, user], user: user)
      |> Repo.all()

    %{
      profiles: profiles,
      page: page,
      page_size: page_size,
      total: total,
      total_pages: total_pages
    }
  end

  def update_profile(%User{id: user_id}, %Profile{user_id: user_id} = profile, attrs) do
    changeset = Profile.changeset(profile, attrs)

    if GoMutationAPI.enabled?() do
      with %{valid?: true} <- changeset,
           :ok <- GoMutationAPI.update(user_id, attrs),
           {:ok, updated_profile} <- get_by_nickname(profile.user.nickname) do
        {:ok, updated_profile}
      else
        %{valid?: false} = invalid_changeset -> {:error, invalid_changeset}
        {:error, :invalid} -> {:error, changeset}
        error -> error
      end
    else
      Repo.update(changeset)
    end
  end

  def update_profile(_actor, _profile, _attrs), do: {:error, :forbidden}

  def put_photo(%User{id: user_id}, %Profile{user_id: user_id} = profile, bytes, content_type)
      when is_binary(bytes) and byte_size(bytes) <= 1_500_000 do
    if GoMutationAPI.enabled?() do
      case GoMutationAPI.put_photo(user_id, bytes, content_type) do
        :ok -> get_by_nickname(profile.user.nickname)
        error -> error
      end
    else
      put_photo_in_phoenix(profile, bytes, content_type)
    end
  end

  def put_photo(_actor, _profile, _bytes, _content_type), do: {:error, :invalid_photo}

  defp put_photo_in_phoenix(profile, bytes, content_type) do
    if Uploads.valid_image?(bytes, content_type) do
      with {:ok, changeset} <-
             profile |> Profile.photo_changeset(bytes, content_type) |> Chat.Media.persist() do
        Repo.update(changeset)
      end
    else
      {:error, :invalid_photo}
    end
  end

  def photo_resource(nickname, field \\ :photo) do
    case get_by_nickname(nickname) do
      {:ok, profile} -> Chat.Media.resource(profile, field)
      _ -> :not_found
    end
  end

  defp normalize_search(search) when is_binary(search) do
    search
    |> String.trim()
    |> String.slice(0, 80)
  end

  defp normalize_search(_search), do: ""

  defp normalize_page(page) when is_integer(page) and page > 0, do: page

  defp normalize_page(page) when is_binary(page) do
    case Integer.parse(page) do
      {number, ""} when number > 0 -> number
      _invalid -> 1
    end
  end

  defp normalize_page(_page), do: 1

  defp normalize_page_size(page_size) when is_integer(page_size) and page_size in 1..100,
    do: page_size

  defp normalize_page_size(_page_size), do: @default_page_size
end
