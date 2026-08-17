# Назначение файла: контекст общего фотоальбома и правил загрузки фотографий.
defmodule Chat.Gallery do
  @moduledoc "Общий фотоальбом зарегистрированных чатлан."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.Gallery.Photo
  alias Chat.Repo

  @max_photo_bytes 2_000_000
  @allowed_content_types ["image/jpeg", "image/png", "image/webp"]

  def list_photos do
    Photo
    |> order_by([photo], desc: photo.inserted_at, desc: photo.id)
    |> preload(:user)
    |> Repo.all()
  end

  def upload_photo(%User{} = user, image, content_type)
      when is_binary(image) and byte_size(image) <= @max_photo_bytes and
             content_type in @allowed_content_types do
    %Photo{}
    |> Photo.create_changeset(user, image, content_type)
    |> Repo.insert()
  end

  def upload_photo(_user, _image, _content_type), do: {:error, :invalid_photo}
end
