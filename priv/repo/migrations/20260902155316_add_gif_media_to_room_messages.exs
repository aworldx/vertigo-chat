defmodule Chat.Repo.Migrations.AddGifMediaToRoomMessages do
  use Ecto.Migration

  def change do
    alter table(:room_messages) do
      add :media_url, :text
    end
  end
end
