# Назначение файла: контекст общего фотоальбома и правил загрузки фотографий.
defmodule Chat.Gallery do
  @moduledoc "Общий фотоальбом зарегистрированных чатлан."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Gallery.Like
  alias Chat.Gallery.Photo
  alias Chat.Ranks
  alias Chat.Repo
  alias Chat.Uploads

  @max_photo_bytes 2_000_000
  @max_thumbnail_bytes 300_000
  @max_photos_per_user 20
  @max_photos_per_day 5
  @max_caption_length 280
  @topic "gallery"

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)

  def list_photos(viewer \\ nil) do
    liked_photo_ids = liked_photo_ids(viewer)

    Photo
    |> join(:left, [photo], like in Like, on: like.photo_id == photo.id)
    |> group_by([photo], photo.id)
    |> order_by([photo], desc: photo.inserted_at, desc: photo.id)
    |> select_merge([_photo, like], %{likes_count: count(like.id)})
    |> preload(:user)
    |> Repo.all()
    |> Enum.map(&%{&1 | liked?: MapSet.member?(liked_photo_ids, &1.id)})
  end

  def get_photo(id) when is_integer(id) and id > 0, do: Repo.get(Photo, id)
  def get_photo(_id), do: nil

  def toggle_like(%User{} = user, photo_id) when is_integer(photo_id) and photo_id > 0 do
    case Repo.get(Photo, photo_id) do
      nil -> {:error, :not_found}
      %{user_id: user_id} when user_id == user.id -> {:error, :own_photo}
      _photo -> toggle_user_like(user, photo_id)
    end
  end

  def toggle_like(_user, _photo_id), do: {:error, :not_found}

  def upload_photo(%User{} = user, image, content_type) when is_binary(image) do
    upload_photo(user, image, content_type, nil)
  end

  def upload_photo(_user, _image, _content_type), do: {:error, :invalid_photo}

  def upload_photo(%User{} = user, image, content_type, caption)
      when is_binary(image) and (is_binary(caption) or is_nil(caption)) do
    upload_photo(user, image, content_type, caption, nil, nil)
  end

  def upload_photo(_user, _image, _content_type, _caption), do: {:error, :invalid_photo}

  def upload_photo(
        %User{} = user,
        image,
        content_type,
        caption,
        thumbnail,
        thumbnail_content_type
      )
      when is_binary(image) and (is_binary(caption) or is_nil(caption)) do
    caption = normalize_caption(caption)

    cond do
      byte_size(image) > @max_photo_bytes ->
        {:error, :invalid_photo}

      not Uploads.valid_image?(image, content_type) ->
        {:error, :invalid_photo}

      not valid_thumbnail?(thumbnail, thumbnail_content_type) ->
        {:error, :invalid_thumbnail}

      caption && String.length(caption) > @max_caption_length ->
        {:error, :invalid_caption}

      true ->
        insert_with_quota(user, image, content_type, caption, thumbnail, thumbnail_content_type)
    end
  end

  def upload_photo(_user, _image, _content_type, _caption, _thumbnail, _thumbnail_content_type),
    do: {:error, :invalid_photo}

  def max_photos_per_user, do: @max_photos_per_user
  def max_photos_per_day, do: @max_photos_per_day
  def max_caption_length, do: @max_caption_length

  defp insert_with_quota(user, image, content_type, caption, thumbnail, thumbnail_content_type) do
    Repo.transaction(
      fn ->
        user = lock_user!(user.id)

        total = Repo.aggregate(from(photo in Photo, where: photo.user_id == ^user.id), :count)

        daily =
          Repo.aggregate(
            from(photo in Photo,
              where:
                photo.user_id == ^user.id and
                  photo.inserted_at >= ago(1, "day")
            ),
            :count
          )

        cond do
          not Ranks.can_add_gallery_photos?(user) ->
            Repo.rollback(:statist_required)

          total >= @max_photos_per_user ->
            Repo.rollback(:photo_limit_reached)

          daily >= @max_photos_per_day ->
            Repo.rollback(:daily_photo_limit_reached)

          true ->
            case %Photo{}
                 |> Photo.create_changeset(
                   user,
                   image,
                   content_type,
                   caption,
                   thumbnail,
                   thumbnail_content_type
                 )
                 |> store_media() do
              {:ok, photo} -> photo
              {:error, changeset} -> Repo.rollback(changeset)
            end
        end
      end,
      timeout: 180_000
    )
    |> case do
      {:ok, photo} ->
        broadcast_change()
        {:ok, photo}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp store_media(changeset) do
    with {:ok, stored} <- Chat.Media.persist(changeset), do: Repo.insert(stored)
  end

  def photo_resource(id, field), do: Chat.Media.resource(get_photo(id), field)

  defp toggle_user_like(user, photo_id) do
    result =
      case Repo.get_by(Like, photo_id: photo_id, user_id: user.id) do
        nil ->
          %Like{}
          |> Like.changeset(photo_id, user.id)
          |> Repo.insert(on_conflict: :nothing, conflict_target: [:photo_id, :user_id])
          |> case do
            {:ok, _like} -> :liked
            {:error, _changeset} -> :error
          end

        like ->
          case Repo.delete(like) do
            {:ok, _like} -> :unliked
            {:error, _changeset} -> :error
          end
      end

    case result do
      result when result in [:liked, :unliked] ->
        broadcast_change()
        {:ok, result}

      :error ->
        {:error, :like_failed}
    end
  end

  defp liked_photo_ids(%User{id: user_id}) do
    Like
    |> where([like], like.user_id == ^user_id)
    |> select([like], like.photo_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp liked_photo_ids(_viewer), do: MapSet.new()

  defp lock_user!(user_id) do
    Repo.one!(from(user in User, where: user.id == ^user_id, lock: "FOR UPDATE"))
  end

  defp normalize_caption(nil), do: nil

  defp normalize_caption(caption) do
    case String.trim(caption) do
      "" -> nil
      caption -> caption
    end
  end

  defp valid_thumbnail?(nil, nil), do: true

  defp valid_thumbnail?(thumbnail, content_type)
       when is_binary(thumbnail) and is_binary(content_type) do
    byte_size(thumbnail) <= @max_thumbnail_bytes and Uploads.valid_image?(thumbnail, content_type)
  end

  defp valid_thumbnail?(_thumbnail, _content_type), do: false

  defp broadcast_change, do: Phoenix.PubSub.broadcast(Chat.PubSub, @topic, :gallery_changed)
end
