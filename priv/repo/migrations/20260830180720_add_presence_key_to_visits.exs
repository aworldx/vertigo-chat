defmodule Chat.Repo.Migrations.AddPresenceKeyToVisits do
  use Ecto.Migration

  def change do
    alter table(:visits) do
      add :presence_key, :string
    end

    create unique_index(:visits, [:presence_key],
             where: "left_at IS NULL AND presence_key IS NOT NULL",
             name: :visits_active_presence_key_index
           )
  end
end
