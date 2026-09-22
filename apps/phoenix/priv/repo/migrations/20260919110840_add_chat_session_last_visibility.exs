defmodule Chat.Repo.Migrations.AddChatSessionLastVisibility do
  use Ecto.Migration

  def change do
    alter table(:chat_sessions) do
      add :last_visibility, :string, null: false, default: "unknown"
    end
  end
end
