defmodule Chat.Repo.Migrations.CreateProfiles do
  use Ecto.Migration

  def change do
    create table(:profiles) do
      add(:user_id, references(:registered_users, on_delete: :delete_all), null: false)
      add(:name, :string)
      add(:birth_date, :date)
      add(:gender, :string)
      add(:about, :text)
      add(:photo, :binary)
      add(:photo_content_type, :string)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:profiles, [:user_id]))
  end
end
