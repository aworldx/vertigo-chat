defmodule Chat.Repo.Migrations.AddEmojiModeration do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :can_moderate_emojis, :boolean, null: false, default: false
    end

    alter table(:emojis) do
      add :user_id, references(:registered_users, on_delete: :nilify_all)
      add :status, :string, null: false, default: "approved"
      add :tags, {:array, :string}, null: false, default: []
      add :width, :integer
      add :height, :integer
      add :animated, :boolean, null: false, default: false
      add :rejection_reason, :text
    end

    create index(:emojis, [:status])
    create index(:emojis, [:user_id])
    create index(:emojis, [:tags], using: :gin)
  end
end
