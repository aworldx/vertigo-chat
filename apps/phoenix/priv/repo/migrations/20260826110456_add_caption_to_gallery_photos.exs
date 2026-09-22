# Назначение файла: добавляет необязательную подпись к фотографиям общего альбома.
defmodule Chat.Repo.Migrations.AddCaptionToGalleryPhotos do
  use Ecto.Migration

  def change do
    alter table(:gallery_photos) do
      add :caption, :string, size: 280
    end
  end
end
