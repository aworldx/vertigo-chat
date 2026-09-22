defmodule Chat.Repo.Migrations.AddMessageSoundToRegisteredUsers do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :message_sound_enabled, :boolean, null: false, default: false
    end
  end
end
