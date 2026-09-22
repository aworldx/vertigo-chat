defmodule Chat.Repo.Migrations.CreateFeedbackEntries do
  use Ecto.Migration

  def change do
    create table(:feedback_entries) do
      add :user_id, references(:registered_users, on_delete: :nilify_all)
      add :name, :string, null: false
      add :body, :text, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:feedback_entries, [:user_id])
    create index(:feedback_entries, [:inserted_at])
  end
end
