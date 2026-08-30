defmodule Chat.Repo.Migrations.AddRankProgressToRegisteredUsers do
  use Ecto.Migration

  def change do
    alter table(:registered_users) do
      add :public_message_count, :integer, null: false, default: 0
      add :chat_seconds, :integer, null: false, default: 0
    end

    alter table(:visits) do
      add :user_id, references(:registered_users, on_delete: :nilify_all)
    end

    create index(:visits, [:user_id])

    execute(
      """
      UPDATE visits
      SET user_id = registered_users.id
      FROM registered_users
      WHERE visits.nickname = registered_users.nickname
      """,
      "UPDATE visits SET user_id = NULL"
    )

    execute(
      """
      UPDATE registered_users
      SET chat_seconds = progress.chat_seconds
      FROM (
        SELECT user_id,
               SUM(EXTRACT(EPOCH FROM (left_at - entered_at)))::integer AS chat_seconds
        FROM visits
        WHERE user_id IS NOT NULL AND left_at IS NOT NULL
        GROUP BY user_id
      ) AS progress
      WHERE registered_users.id = progress.user_id
      """,
      "UPDATE registered_users SET chat_seconds = 0"
    )
  end
end
