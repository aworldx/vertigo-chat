# Назначение файла: Ecto-схема трека, добавленного в общий хит-парад.
defmodule Chat.MusicChart.Track do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "music_chart_tracks" do
    field :title, :string
    field :audio, :binary
    field :content_type, :string
    field :likes_count, :integer, virtual: true, default: 0
    field :liked?, :boolean, virtual: true, default: false

    belongs_to :user, User
    has_many :likes, Chat.MusicChart.Like

    timestamps(type: :utc_datetime)
  end

  def changeset(track, user, title, audio, content_type) do
    track
    |> cast(%{"title" => title}, [:title])
    |> change(audio: audio, content_type: content_type)
    |> put_assoc(:user, user)
    |> validate_required([:title, :audio, :content_type, :user])
    |> validate_length(:title, max: 120)
  end
end
