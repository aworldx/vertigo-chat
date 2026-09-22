defmodule Chat.Repo.Migrations.AllowNullEmojiImageForS3Uploads do
  use Ecto.Migration

  def change do
    alter table(:emojis) do
      # Локальное хранилище использует `image`, а S3 — `image_key`.
      modify :image, :binary, null: true
    end
  end
end
