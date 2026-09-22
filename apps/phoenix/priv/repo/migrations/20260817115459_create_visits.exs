defmodule Chat.Repo.Migrations.CreateVisits do
  use Ecto.Migration

  def change do
    create table(:visits) do
      add :nickname, :string, null: false
      add :entered_at, :utc_datetime, null: false
      add :left_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:visits, [:entered_at])
    create index(:visits, [:nickname])
  end
end
