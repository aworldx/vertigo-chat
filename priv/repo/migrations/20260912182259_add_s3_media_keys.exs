defmodule Chat.Repo.Migrations.AddS3MediaKeys do
  use Ecto.Migration

  def up do
    alter table(:profiles) do
      add :photo_key, :text
      add :thumbnail, :binary
      add :thumbnail_key, :text
      add :thumbnail_content_type, :string
    end

    alter table(:gallery_photos) do
      add :image_key, :text
      add :thumbnail_key, :text
      modify :image, :binary, null: true
    end

    alter table(:music_chart_tracks) do
      add :audio_key, :text
      modify :audio, :binary, null: true
    end

    create constraint(:gallery_photos, :gallery_media_required,
             check: "image IS NOT NULL OR image_key IS NOT NULL"
           )

    create constraint(:music_chart_tracks, :track_media_required,
             check: "audio IS NOT NULL OR audio_key IS NOT NULL"
           )
  end

  def down do
    raise "Restore S3 media into binary columns before reverting this migration"
  end
end
