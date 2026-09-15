defmodule Chat.Repo.Migrations.RemoveHiddenEmojiStatus do
  use Ecto.Migration

  def up do
    execute("UPDATE emojis SET status = 'rejected' WHERE status = 'hidden'")
  end

  def down do
  end
end
