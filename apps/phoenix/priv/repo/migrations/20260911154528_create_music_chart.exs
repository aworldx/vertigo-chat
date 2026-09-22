defmodule Chat.Repo.Migrations.CreateMusicChart do
  use Ecto.Migration

  def change do
    create table(:music_chart_tracks) do
      add :title, :string, null: false
      add :audio, :binary, null: false
      add :content_type, :string, null: false
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:music_chart_tracks, [:user_id])

    create table(:music_chart_likes) do
      add :track_id, references(:music_chart_tracks, on_delete: :delete_all), null: false
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:music_chart_likes, [:track_id, :user_id])
    create index(:music_chart_likes, [:user_id])
  end
end
