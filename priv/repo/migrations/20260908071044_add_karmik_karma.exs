defmodule Chat.Repo.Migrations.AddKarmikKarma do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :karma, :integer, null: false, default: 0
    end

    create table(:karmik_assessments) do
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false
      add :room_message_id, :bigint, null: false
      add :delta, :integer, null: false
      add :assessed_on, :date, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:karmik_assessments, [:user_id, :room_message_id])
    create index(:karmik_assessments, [:user_id, :assessed_on])
  end
end
