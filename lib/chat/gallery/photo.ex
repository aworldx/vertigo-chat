# Назначение файла: Ecto-схема фотографии общего фотоальбома.
defmodule Chat.Gallery.Photo do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "gallery_photos" do
    field :image, :binary
    field :content_type, :string

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def create_changeset(photo, user, image, content_type) do
    photo
    |> change(image: image, content_type: content_type)
    |> put_assoc(:user, user)
    |> validate_required([:image, :content_type, :user])
  end
end
