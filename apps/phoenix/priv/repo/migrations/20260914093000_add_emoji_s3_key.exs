defmodule Chat.Repo.Migrations.AddEmojiS3Key do
  use Ecto.Migration

  def change do
    alter table(:emojis) do
      add :image_key, :string
    end

    create unique_index(:emojis, [:image_key], where: "image_key IS NOT NULL")
  end
end
