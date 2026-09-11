# Назначение файла: Ecto-схема одного голоса за трек хит-парада.
defmodule Chat.MusicChart.Like do
  use Ecto.Schema

  import Ecto.Changeset

  schema "music_chart_likes" do
    belongs_to :track, Chat.MusicChart.Track
    belongs_to :user, Chat.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(like, track_id, user_id) do
    like
    |> change(track_id: track_id, user_id: user_id)
    |> unique_constraint([:track_id, :user_id])
  end
end
