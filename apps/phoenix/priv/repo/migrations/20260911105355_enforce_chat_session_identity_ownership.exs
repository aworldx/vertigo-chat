defmodule Chat.Repo.Migrations.EnforceChatSessionIdentityOwnership do
  use Ecto.Migration

  def change do
    create unique_index(:chat_sessions, [:room_id, :identity_key],
             where: "status IN ('active', 'reconnecting')",
             name: :chat_sessions_active_room_identity_index
           )

    create index(:chat_sessions, [:last_seen_at], where: "status = 'active'")
  end
end
