defmodule Chat.Repo.Migrations.CreateEmojiTags do
  use Ecto.Migration

  def change do
    create table(:emoji_tags) do
      add :name, :string, null: false
      timestamps(type: :utc_datetime)
    end

    create unique_index(:emoji_tags, [:name])

    create table(:emoji_tag_assignments, primary_key: false) do
      add :emoji_id, references(:emojis, on_delete: :delete_all), null: false
      add :emoji_tag_id, references(:emoji_tags, on_delete: :delete_all), null: false
    end

    create unique_index(:emoji_tag_assignments, [:emoji_id, :emoji_tag_id])
    create index(:emoji_tag_assignments, [:emoji_tag_id])
  end
end
