defmodule Chat.Repo.Migrations.ScopeRoomMessageClientIdsToAuthorIdentity do
  use Ecto.Migration

  def change do
    alter table(:room_messages) do
      add :author_identity, :string
    end

    drop unique_index(:room_messages, [:room_id, :client_id])

    create unique_index(:room_messages, [:room_id, :author_identity, :client_id],
             name: :room_messages_outbox_id_index
           )
  end
end
