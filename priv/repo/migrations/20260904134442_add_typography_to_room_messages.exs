defmodule Chat.Repo.Migrations.AddTypographyToRoomMessages do
  use Ecto.Migration

  def change do
    alter table(:room_messages) do
      add :font_id, :string, null: false, default: "theme"
      add :font_style, :string, null: false, default: "normal"
    end
  end
end
