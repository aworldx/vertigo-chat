defmodule Chat.Repo.Migrations.AddGalleryLikesAndMusicComments do
  use Ecto.Migration

  def change do
    create table(:gallery_photo_likes) do
      add :photo_id, references(:gallery_photos, on_delete: :delete_all), null: false
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:gallery_photo_likes, [:photo_id, :user_id])
    create index(:gallery_photo_likes, [:user_id])

    create table(:music_chart_comments) do
      add :track_id, references(:music_chart_tracks, on_delete: :delete_all), null: false
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false
      add :body, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:music_chart_comments, [:track_id, :inserted_at])
    create index(:music_chart_comments, [:user_id])
  end
end
