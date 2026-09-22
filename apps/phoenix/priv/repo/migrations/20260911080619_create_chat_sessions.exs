defmodule Chat.Repo.Migrations.CreateChatSessions do
  use Ecto.Migration

  def up do
    create table(:chat_sessions, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :room_id, :string, null: false
      add :identity_key, :string, null: false
      add :nickname, :string, null: false
      add :resume_secret_hash, :string, null: false
      add :status, :string, null: false
      add :last_seen_at, :utc_datetime, null: false
      add :reconnect_deadline_at, :utc_datetime
      add :ended_at, :utc_datetime
      add :generation, :bigint, null: false, default: 0
      add :visit_id, references(:visits, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:chat_sessions, [:room_id, :identity_key])
    create index(:chat_sessions, [:status, :reconnect_deadline_at])

    create unique_index(:chat_sessions, [:room_id, :nickname],
             where: "status IN ('active', 'reconnecting')",
             name: :chat_sessions_active_room_nickname_index
           )
  end

  def down do
    drop table(:chat_sessions)
  end
end
