defmodule Chat.Repo.Migrations.AddAdminRoleToRegisteredUsers do
  use Ecto.Migration

  def up do
    alter table(:registered_users) do
      add :is_admin, :boolean, null: false, default: false
    end

    execute("""
    UPDATE registered_users
    SET is_admin = TRUE
    WHERE id = (
      SELECT id
      FROM registered_users
      ORDER BY inserted_at ASC, id ASC
      LIMIT 1
    )
    """)
  end

  def down do
    alter table(:registered_users) do
      remove :is_admin
    end
  end
end
