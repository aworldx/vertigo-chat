defmodule Chat.Sessions.LifecycleTest do
  use Chat.DataCase, async: false

  alias Chat.{Chatlans, Messages, Repo, Sessions}
  alias Chat.Sessions.{ChatSession, Store, Reaper}
  alias Chat.Visits.Visit

  test "rejects missing secrets, a different identity, room and nickname without changing state" do
    session = enter()

    for overrides <- [
          %{resume_secret: nil},
          %{resume_secret: String.duplicate("x", 43)},
          %{identity_key: "guest:#{Ecto.UUID.generate()}"},
          %{nickname: "someone_else"}
        ] do
      assert {:error, _} = Sessions.restore(session.room_id, Map.merge(attrs(session), overrides))
    end

    assert {:error, :invalid_session} = Sessions.restore("another-room", attrs(session))

    assert {:error, :invalid_session} =
             Store.restore("bad-uuid", session.identity_key, session.resume_secret)

    assert Repo.get!(ChatSession, session.session_id).generation == session.connection_epoch
  end

  test "deadline closes exactly the linked visit and persists one departure across reaper restarts" do
    session = enter()
    :ok = Messages.subscribe(session.room_id)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    assert {:ok, deadline} =
             Store.reconnect(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               DateTime.add(now, -60)
             )

    assert deadline == now
    assert {:error, :session_ended} = Sessions.restore(session.room_id, attrs(session))

    reaper = start_supervised!({Reaper, name: :lifecycle_reaper, interval: 60_000})
    send(reaper, :reap)
    :sys.get_state(reaper)
    assert_receive {:message_created, %{body: "из чата выходит " <> _}}
    assert Repo.get!(Visit, session.visit.id).left_at
    assert Repo.get!(ChatSession, session.session_id).status == "ended"
    assert [] = Store.live(session.room_id)

    stop_supervised!(Reaper)
    restarted = start_supervised!({Reaper, name: :lifecycle_reaper, interval: 60_000})
    send(restarted, :reap)
    :sys.get_state(restarted)
    refute_receive {:message_created, %{body: "из чата выходит " <> _}}, 30
    assert [_] = Messages.list_recent_messages(session.room_id)
    assert {:error, :session_ended} = Sessions.restore(session.room_id, attrs(session))
  end

  test "restore fences a previously selected reaper candidate and late transport events" do
    session = enter()
    assert :ok = Sessions.connection_lost(session, self())
    [candidate] = Store.pending(session.room_id)
    assert {:ok, restored} = Sessions.restore(session.room_id, attrs(session))
    restored = connect(restored)
    assert :stale = Store.expire(candidate, candidate.reconnect_deadline_at)
    assert :ok = Sessions.leave(session, self())
    assert :ok = Sessions.connection_lost(session, self())
    assert :ok = Sessions.touch(session)
    assert Sessions.current_connection?(restored)
    assert Repo.get!(Visit, session.visit.id).left_at == nil
    assert restored.visit.id == session.visit.id
  end

  test "heartbeat survives process state loss and abandoned active sessions eventually expire" do
    session = enter()
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    assert :ok =
             Store.touch(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               DateTime.add(now, -181)
             )

    assert :ok = Sessions.reap(now)
    [pending] = Store.pending(session.room_id)

    assert {:error, :nickname_online} =
             Sessions.enter(session.room_id, session.nickname, "",
               presence_key: Chatlans.guest_presence_key()
             )

    assert :ok = Sessions.reap(pending.reconnect_deadline_at)
    assert Repo.get!(ChatSession, session.session_id).status == "ended"

    assert {:ok, next} =
             Sessions.enter(session.room_id, session.nickname, "",
               presence_key: Chatlans.guest_presence_key()
             )

    assert next.session_id != session.session_id
    assert next.visit.id != session.visit.id
  end

  test "failed second entrance creates neither a session nor a visit" do
    session = enter()

    assert {:error, :nickname_online} =
             Sessions.enter(session.room_id, session.nickname, "",
               presence_key: Chatlans.guest_presence_key()
             )

    assert Repo.aggregate(ChatSession, :count) == 1
    assert Repo.aggregate(Visit, :count) == 1
  end

  test "the legacy visit janitor cannot close a visit owned by a durable session" do
    session = enter()
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    stale = DateTime.add(now, -600)
    Repo.update_all(from(v in Visit, where: v.id == ^session.visit.id), set: [updated_at: stale])
    assert :ok = Chat.Visits.cleanup_stale_visits(now: now)
    assert Repo.get!(Visit, session.visit.id).left_at == nil
  end

  test "activation cannot renew an expired lease before the reaper runs" do
    session = enter()
    later = DateTime.add(DateTime.utc_now(), 241)

    assert :stale =
             Store.touch(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               later
             )

    assert {:error, :stale_connection} =
             Store.activate(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               later
             )
  end

  test "registration upgrades identity and rotates the secret without changing the visit" do
    session = enter()

    assert {:ok, registered} =
             Sessions.register_user(
               session,
               %{"nickname" => "ignored_name", "password" => "secret123"},
               nil
             )

    assert registered.nickname == session.nickname
    assert registered.identity_key == "user:#{registered.user.id}"
    assert registered.visit.id == session.visit.id
    assert registered.visit.user_id == registered.user.id
    assert registered.resume_secret != session.resume_secret

    assert {:error, :invalid_session} =
             Store.restore(session.session_id, session.identity_key, session.resume_secret)

    assert {:ok, restored} =
             Sessions.restore(session.room_id, Map.put(attrs(registered), :user, registered.user))

    assert restored.visit.id == session.visit.id
    assert :ok = Sessions.leave(session, self())
    assert Repo.get!(ChatSession, session.session_id).status == "active"
  end

  test "a stale guest cannot create an account after its session leaves" do
    session = enter()
    assert :ok = Sessions.leave(session, self())

    assert {:error, :stale_connection} =
             Sessions.register_user(session, %{"password" => "secret123"}, nil)

    refute Chat.Accounts.registered_nickname?(session.nickname)
  end

  defp enter do
    {:ok, session} =
      Sessions.enter("lifecycle-#{Ecto.UUID.generate()}", "lifecycle_guest", "",
        presence_key: Chatlans.guest_presence_key()
      )

    connect(session)
  end

  defp connect(session) do
    {:ok, _, session} =
      Sessions.connect(session, self(), %{
        nickname: session.nickname,
        session_id: session.session_id,
        identity_key: session.identity_key
      })

    session
  end

  defp attrs(session),
    do: %{
      nickname: session.nickname,
      session_id: session.session_id,
      identity_key: session.identity_key,
      resume_secret: session.resume_secret,
      presence_key: Chatlans.guest_presence_key()
    }
end
