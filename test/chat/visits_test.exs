# Назначение файла: тесты истории входов и выходов чатлан.
defmodule Chat.VisitsTest do
  use Chat.DataCase

  alias Chat.Visits

  test "starts and finishes a visit" do
    entered_at = ~U[2026-08-17 08:00:00Z]
    left_at = ~U[2026-08-17 09:30:00Z]

    assert {:ok, visit} = Visits.start_visit("visitor", entered_at)
    assert visit.nickname == "visitor"
    assert visit.entered_at == entered_at
    assert visit.left_at == nil

    assert {:ok, finished} = Visits.finish_visit(visit, left_at)
    assert finished.left_at == left_at
    assert {:ok, ^finished} = Visits.finish_visit(finished, DateTime.add(left_at, 60, :second))
  end

  test "lists only visits inside the requested two-day window in newest-first order" do
    now = ~U[2026-08-17 12:00:00Z]
    since = DateTime.add(now, -48, :hour)

    {:ok, _old} = Visits.start_visit("old_user", DateTime.add(since, -1, :second))
    {:ok, first} = Visits.start_visit("first_user", DateTime.add(since, 1, :second))
    {:ok, second} = Visits.start_visit("second_user", now)

    assert Enum.map(Visits.list_recent_visits(since: since), & &1.id) == [second.id, first.id]
    assert Visits.history_hours() == 48
  end

  test "rejects an invalid nickname" do
    assert {:error, changeset} = Visits.start_visit("x")
    assert %{nickname: [_message]} = errors_on(changeset)
  end
end
