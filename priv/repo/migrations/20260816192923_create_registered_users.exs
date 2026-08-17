# Назначение файла: миграция таблицы зарегистрированных пользователей с уникальным ником и хэшем пароля.
defmodule Chat.Repo.Migrations.CreateRegisteredUsers do
  use Ecto.Migration

  def change do
    create table(:registered_users) do
      add :nickname, :string, null: false
      add :password_hash, :string, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:registered_users, [:nickname])
  end
end
