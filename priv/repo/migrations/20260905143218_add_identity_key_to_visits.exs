defmodule Chat.Repo.Migrations.AddIdentityKeyToVisits do
  use Ecto.Migration

  def up do
    alter table(:visits) do
      add :identity_key, :string
    end

    execute("""
    UPDATE visits
    SET identity_key = CASE
      WHEN user_id IS NOT NULL THEN 'user:' || user_id::text
      WHEN session_id IS NOT NULL THEN 'guest:' || session_id
      ELSE 'legacy:' || id::text
    END
    """)

    alter table(:visits) do
      modify :identity_key, :string, null: false
    end

    execute("""
    WITH following_active_visit AS (
      SELECT
        id,
        LEAD(entered_at) OVER (PARTITION BY identity_key ORDER BY entered_at, id) AS next_entered_at
      FROM visits
      WHERE left_at IS NULL
    )
    UPDATE visits AS visit
    SET left_at = following_active_visit.next_entered_at,
        updated_at = following_active_visit.next_entered_at
    FROM following_active_visit
    WHERE visit.id = following_active_visit.id
      AND following_active_visit.next_entered_at IS NOT NULL
    """)

    create unique_index(:visits, [:identity_key],
             where: "left_at IS NULL",
             name: :visits_active_identity_key_index
           )
  end

  def down do
    drop index(:visits, [:identity_key], name: :visits_active_identity_key_index)

    alter table(:visits) do
      remove :identity_key
    end
  end
end
