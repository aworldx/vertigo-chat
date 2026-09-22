defmodule Chat.Gallery.Like do
  use Ecto.Schema

  import Ecto.Changeset

  schema "gallery_photo_likes" do
    belongs_to :photo, Chat.Gallery.Photo
    belongs_to :user, Chat.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(like, photo_id, user_id) do
    like
    |> cast(%{}, [])
    |> put_change(:photo_id, photo_id)
    |> put_change(:user_id, user_id)
    |> unique_constraint([:photo_id, :user_id])
  end
end
