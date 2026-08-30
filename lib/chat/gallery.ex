# Назначение файла: контекст общего фотоальбома и правил загрузки фотографий.
defmodule Chat.Gallery do
  @moduledoc "Общий фотоальбом зарегистрированных чатлан."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Gallery.Photo
  alias Chat.Ranks
  alias Chat.Repo
  alias Chat.Uploads

  @max_photo_bytes 2_000_000
  @max_photos_per_user 20
  @max_photos_per_day 5
  @max_caption_length 280

  def list_photos do
    Photo
    |> order_by([photo], desc: photo.inserted_at, desc: photo.id)
    |> preload(:user)
    |> Repo.all()
  end

  def upload_photo(%User{} = user, image, content_type) when is_binary(image) do
    upload_photo(user, image, content_type, nil)
  end

  def upload_photo(_user, _image, _content_type), do: {:error, :invalid_photo}

  def upload_photo(%User{} = user, image, content_type, caption)
      when is_binary(image) and (is_binary(caption) or is_nil(caption)) do
    caption = normalize_caption(caption)

    cond do
      byte_size(image) > @max_photo_bytes ->
        {:error, :invalid_photo}

      not Uploads.valid_image?(image, content_type) ->
        {:error, :invalid_photo}

      caption && String.length(caption) > @max_caption_length ->
        {:error, :invalid_caption}

      true ->
        insert_with_quota(user, image, content_type, caption)
    end
  end

  def upload_photo(_user, _image, _content_type, _caption), do: {:error, :invalid_photo}

  def max_photos_per_user, do: @max_photos_per_user
  def max_photos_per_day, do: @max_photos_per_day
  def max_caption_length, do: @max_caption_length

  defp insert_with_quota(user, image, content_type, caption) do
    Repo.transaction(fn ->
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
               |> Photo.create_changeset(user, image, content_type, caption)
               |> Repo.insert() do
            {:ok, photo} -> photo
            {:error, changeset} -> Repo.rollback(changeset)
          end
      end
    end)
  end

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
end
