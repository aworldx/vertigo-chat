defmodule Chat.Repo.Migrations.AddClientIdToRoomMessages do
  use Ecto.Migration

  def change do
    alter table(:room_messages) do
      add :client_id, :string
    end

    create unique_index(:room_messages, [:room_id, :client_id])
  end
end
