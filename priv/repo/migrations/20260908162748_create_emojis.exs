defmodule Chat.Repo.Migrations.CreateEmojis do
  use Ecto.Migration

  def change do
    create table(:emojis) do
      add :code, :string, null: false
      add :image, :binary, null: false
      add :content_type, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:emojis, [:code])
  end
end
