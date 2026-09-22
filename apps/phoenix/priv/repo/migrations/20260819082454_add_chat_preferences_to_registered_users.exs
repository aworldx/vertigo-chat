defmodule Chat.Repo.Migrations.AddChatPreferencesToRegisteredUsers do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :theme_id, :string, null: false, default: "vertigo"
      add :appearance, :map, null: false, default: %{}
    end
  end
end
