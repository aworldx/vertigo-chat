defmodule Chat.Repo.Migrations.AddMusicMetadataToRoomMessages do
  use Ecto.Migration

  def change do
    alter table(:room_messages) do
      add :media_artist, :string
      add :media_duration, :string
      add :media_source_url, :text
    end
  end
end
