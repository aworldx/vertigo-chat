defmodule Chat.Repo.Migrations.AddGameGuestIdentities do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :is_game_guest, :boolean, null: false, default: false
      add :game_nickname, :string
      add :guest_identity_id, :uuid
    end

    create unique_index(:registered_users, [:guest_identity_id],
             where: "guest_identity_id IS NOT NULL"
           )

    create index(:registered_users, [:is_game_guest, :updated_at])
  end
end
