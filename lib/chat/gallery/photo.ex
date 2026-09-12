# Назначение файла: Ecto-схема фотографии общего фотоальбома.
defmodule Chat.Gallery.Photo do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "gallery_photos" do
    field :image, :binary
    field :image_key, :string
    field :thumbnail_key, :string
    field :content_type, :string
    field :thumbnail, :binary
    field :thumbnail_content_type, :string
    field :caption, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def create_changeset(
        photo,
        user,
        image,
        content_type,
        caption,
        thumbnail,
        thumbnail_content_type
      ) do
    photo
    |> cast(%{"caption" => caption}, [:caption])
    |> change(
      image: image,
      content_type: content_type,
      thumbnail: thumbnail,
      thumbnail_content_type: thumbnail_content_type
    )
    |> put_assoc(:user, user)
    |> validate_required([:image, :content_type, :user])
    |> validate_length(:caption, max: 280)
  end
end
