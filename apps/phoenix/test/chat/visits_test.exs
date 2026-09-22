# Назначение файла: тесты истории входов и выходов чатлан.
defmodule Chat.VisitsTest do
  use Chat.DataCase

  alias Chat.Visits
  alias Chat.Visits.Visit
  alias Chat.Repo

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

  test "reuses an active visit for the same server session" do
    session_id = Ecto.UUID.generate()
    entered_at = ~U[2026-08-17 08:00:00Z]

    assert {:ok, first} = Visits.start_visit("visitor", entered_at, session_id: session_id)

    assert {:ok, same_visit} =
             Visits.start_visit("visitor", DateTime.add(entered_at, 1, :minute),
               session_id: session_id
             )

    assert same_visit.id == first.id
    assert [^first] = Visits.list_recent_visits(since: DateTime.add(entered_at, -1, :second))
  end

  test "reuses one active visit across multiple connections of the same identity" do
    identity_key = Visits.guest_identity_key(Ecto.UUID.generate())
    entered_at = ~U[2026-08-17 08:00:00Z]

    assert {:ok, first} =
             Visits.start_visit("visitor", entered_at,
               session_id: Ecto.UUID.generate(),
               identity_key: identity_key
             )

    assert {:ok, same_visit} =
             Visits.start_visit("visitor", DateTime.add(entered_at, 1, :minute),
               session_id: Ecto.UUID.generate(),
               identity_key: identity_key
             )

    assert same_visit.id == first.id
  end

  test "shows only the newest active visit for duplicate legacy nicknames" do
    entered_at = ~U[2026-08-17 08:00:00Z]
    assert {:ok, older} = Visits.start_visit("legacy_visitor", entered_at)

    assert {:ok, newer} =
             Visits.start_visit("legacy_visitor", DateTime.add(entered_at, 1, :minute))

    assert [^newer] = Visits.list_recent_visits(since: DateTime.add(entered_at, -1, :second))
    assert newer.id != older.id
  end

  test "closes an abandoned visit when its identity is offline" do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    entered_at = DateTime.add(now, -2, :day)
    session_id = Ecto.UUID.generate()

    visit =
      Repo.insert!(%Visit{
        nickname: "stale_visitor",
        identity_key: Visits.guest_identity_key(session_id),
        session_id: session_id,
        entered_at: entered_at,
        inserted_at: entered_at,
        updated_at: entered_at
      })

    assert :ok = Visits.cleanup_stale_visits(now: now)
    assert %{left_at: ^now} = Repo.get!(Visit, visit.id)
  end
end
