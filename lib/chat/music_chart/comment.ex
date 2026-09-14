defmodule Chat.MusicChart.Comment do
  use Ecto.Schema

  import Ecto.Changeset

  schema "music_chart_comments" do
    field :body, :string

    belongs_to :track, Chat.MusicChart.Track
    belongs_to :user, Chat.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(comment, track_id, user_id, body) do
    comment
    |> cast(%{"body" => body}, [:body])
    |> update_change(:body, &String.trim/1)
    |> validate_required([:body])
    |> validate_length(:body, max: Chat.MusicChart.max_comment_length())
    |> put_change(:track_id, track_id)
    |> put_change(:user_id, user_id)
  end
end
