defmodule Chat.Repo.Migrations.CreateLibraryArticles do
  use Ecto.Migration

  def change do
    create table(:library_articles) do
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false
      add :title, :string, null: false
      add :body, :text, null: false
      add :series, :string
      add :part_number, :integer

      timestamps(type: :utc_datetime)
    end

    create index(:library_articles, [:user_id])
    create index(:library_articles, [:inserted_at])
    create index(:library_articles, [:user_id, :series, :part_number])
  end
end
