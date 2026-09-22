defmodule Chat.Repo.Migrations.AddForumEmailToRegisteredUsers do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :email, :string
    end

    create unique_index(:registered_users, ["lower(email)"],
             where: "email IS NOT NULL",
             name: :registered_users_lower_email_index
           )
  end
end
