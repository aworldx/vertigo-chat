defmodule Chat.Repo.Migrations.CreateGamesAndGamePlayers do
  use Ecto.Migration

  def change do
    create table(:games) do
      add :kind, :string, null: false
      add :creator_id, references(:registered_users, on_delete: :delete_all), null: false
      add :winner_id, references(:registered_users, on_delete: :nilify_all)
      add :status, :string, null: false, default: "waiting"
      add :state, :map, null: false, default: %{}
      timestamps(type: :utc_datetime)
    end

    create index(:games, [:kind, :status])
    create index(:games, [:creator_id])
    create index(:games, [:winner_id])
    create constraint(:games, :valid_game_kind, check: "kind IN ('battleship', 'durak', 'balda')")

    create constraint(:games, :valid_game_status,
             check: "status IN ('waiting', 'active', 'finished', 'cancelled')"
           )

    create table(:game_players) do
      add :game_id, references(:games, on_delete: :delete_all), null: false
      add :user_id, references(:registered_users, on_delete: :delete_all), null: false
      add :position, :integer, null: false
      add :score, :integer, null: false, default: 0
      timestamps(type: :utc_datetime)
    end

    create unique_index(:game_players, [:game_id, :user_id])
    create unique_index(:game_players, [:game_id, :position])
    create index(:game_players, [:user_id])
  end
end
