defmodule Chat.Repo.Migrations.AddThumbnailsToGalleryPhotos do
  use Ecto.Migration

  def change do
    alter table(:gallery_photos) do
      add :thumbnail, :binary
      add :thumbnail_content_type, :string
    end
  end
end
