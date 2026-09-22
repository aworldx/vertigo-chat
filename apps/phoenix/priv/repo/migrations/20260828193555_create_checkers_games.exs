defmodule Chat.Repo.Migrations.CreateCheckersGames do
  use Ecto.Migration

  def change do
    create table(:checkers_games) do
      add :inviter_id, references(:registered_users, on_delete: :delete_all), null: false
      add :opponent_id, references(:registered_users, on_delete: :delete_all), null: false
      add :white_id, references(:registered_users, on_delete: :delete_all)
      add :winner_id, references(:registered_users, on_delete: :nilify_all)
      add :status, :string, null: false, default: "pending"
      add :board, :map, null: false, default: %{}
      add :turn, :string, null: false, default: "white"
      add :forced_from, :string

      timestamps(type: :utc_datetime)
    end

    create index(:checkers_games, [:inviter_id])
    create index(:checkers_games, [:opponent_id])
    create index(:checkers_games, [:winner_id])

    create constraint(:checkers_games, :different_checkers_players,
             check: "inviter_id <> opponent_id"
           )

    create constraint(:checkers_games, :valid_checkers_status,
             check: "status IN ('pending', 'active', 'finished', 'declined')"
           )

    create constraint(:checkers_games, :valid_checkers_turn, check: "turn IN ('white', 'black')")
  end
end
