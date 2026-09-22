defmodule Chat.Repo.Migrations.ReplaceLightThemeWithNewspaper do
  use Ecto.Migration

  def up do
    execute("UPDATE registered_users SET theme_id = 'newspaper' WHERE theme_id = 'light'")
  end
end
