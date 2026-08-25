defmodule Chat.Repo.Migrations.CreateBotMemory do
  use Ecto.Migration

  def change do
    create table(:bot_conversations) do
      add :subject_key, :string, null: false
      add :nickname, :string, null: false
      add :registered, :boolean, null: false, default: false
      add :summary, :text, null: false, default: ""
      add :exchange_count, :integer, null: false, default: 0
      add :last_interaction_at, :utc_datetime_usec
      add :user_id, references(:registered_users, on_delete: :delete_all)

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:bot_conversations, [:subject_key])
    create index(:bot_conversations, [:user_id])
    create index(:bot_conversations, [:registered, :last_interaction_at])

    create table(:bot_messages) do
      add :role, :string, null: false
      add :body, :text, null: false

      add :conversation_id, references(:bot_conversations, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:bot_messages, [:conversation_id, :inserted_at])
  end
end
