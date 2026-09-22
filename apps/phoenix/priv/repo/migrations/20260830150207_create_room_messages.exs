defmodule Chat.Repo.Migrations.CreateRoomMessages do
  use Ecto.Migration

  def change do
    create table(:room_messages) do
      add :room_id, :string, null: false
      add :kind, :string, null: false
      add :author, :string, null: false
      add :body, :text, null: false
      add :recipient, :string
      add :theme_id, :string, null: false
      add :appearance, :map, null: false, default: %{}
      add :rank, :map
      add :reactions, :map, null: false, default: %{}
      add :sent_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create index(:room_messages, [:room_id, :sent_at])
  end
end
