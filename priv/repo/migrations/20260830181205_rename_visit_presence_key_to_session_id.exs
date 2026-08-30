defmodule Chat.Repo.Migrations.RenameVisitPresenceKeyToSessionId do
  use Ecto.Migration

  def change do
    drop index(:visits, [:presence_key], name: :visits_active_presence_key_index)

    rename table(:visits), :presence_key, to: :session_id

    create unique_index(:visits, [:session_id],
             where: "left_at IS NULL AND session_id IS NOT NULL",
             name: :visits_active_session_id_index
           )
  end
end
