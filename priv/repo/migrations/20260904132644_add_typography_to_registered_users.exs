defmodule Chat.Repo.Migrations.AddTypographyToRegisteredUsers do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :font_id, :string, null: false, default: "theme"
      add :font_style, :string, null: false, default: "normal"
    end
  end
end
