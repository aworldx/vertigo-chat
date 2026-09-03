defmodule Chat.Repo.Migrations.RepairLegacyVisitDurations do
  use Ecto.Migration

  def up do
    execute("""
    WITH following_visits AS (
      SELECT
        id,
        LEAD(entered_at) OVER (PARTITION BY user_id ORDER BY entered_at, id) AS next_entered_at
      FROM visits
      WHERE user_id IS NOT NULL
    )
    UPDATE visits AS visit
    SET left_at = following_visits.next_entered_at,
        updated_at = following_visits.next_entered_at
    FROM following_visits
    WHERE visit.id = following_visits.id
      AND visit.session_id IS NULL
      AND visit.left_at IS NOT NULL
      AND following_visits.next_entered_at IS NOT NULL
      AND visit.left_at > following_visits.next_entered_at
    """)

    execute("UPDATE registered_users SET chat_seconds = 0")

    execute("""
    UPDATE registered_users AS registered_user
    SET chat_seconds = totals.chat_seconds
    FROM (
      SELECT
        user_id,
        SUM(GREATEST(EXTRACT(EPOCH FROM (left_at - entered_at)), 0))::integer AS chat_seconds
      FROM visits
      WHERE user_id IS NOT NULL AND left_at IS NOT NULL
      GROUP BY user_id
    ) AS totals
    WHERE registered_user.id = totals.user_id
    """)
  end

  def down, do: :ok
end
