defmodule Chat.Repo.Migrations.CreateRegistrationGuards do
  use Ecto.Migration

  def change do
    create table(:security_registration_guards) do
      add :fingerprint, :string, null: false
      add :day, :date, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:security_registration_guards, [:fingerprint, :day])
    create index(:security_registration_guards, [:day])
  end
end
