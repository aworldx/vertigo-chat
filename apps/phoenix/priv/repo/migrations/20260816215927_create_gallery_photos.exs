# Назначение файла: создаёт отдельную таблицу фотографий общего фотоальбома.
defmodule Chat.Repo.Migrations.CreateGalleryPhotos do
  use Ecto.Migration

  def change do
    create table(:gallery_photos) do
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false
      add :image, :binary, null: false
      add :content_type, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:gallery_photos, [:user_id])
    create index(:gallery_photos, [:inserted_at])
  end
end
