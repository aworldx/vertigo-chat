# Назначение файла: контекстные тесты переходов жизненного цикла чат-сессии.
defmodule Chat.SessionsTest do
  use Chat.DataCase, async: false

  alias Chat.Accounts
  alias Chat.Sessions.Store
  alias Chat.Messages
  alias Chat.Sessions
  alias Chat.Sessions.Session

  test "registers an account and its first session atomically" do
    attrs = %{"nickname" => "new_session_user", "password" => "secret123"}

    assert {:ok, session} =
             Sessions.register_and_enter("signup-room", attrs, nil,
               presence_key: Ecto.UUID.generate()
             )

    assert session.user.nickname == attrs["nickname"]
    assert session.visit.user_id == session.user.id
    assert session.identity_key == "user:#{session.user.id}"
  end

  test "rolls back registration when the nickname belongs to an active guest session" do
    assert {:ok, _guest} =
             Sessions.enter("signup-conflict", "reserved_guest", "",
               presence_key: Ecto.UUID.generate()
             )

    attrs = %{"nickname" => "reserved_guest", "password" => "secret123"}

    assert {:error, :nickname_online} =
             Sessions.register_and_enter("signup-conflict", attrs, nil,
               presence_key: Ecto.UUID.generate()
             )

    refute Accounts.registered_nickname?("reserved_guest")
  end

  test "rejects an invalid entrance before a session exists" do
    room_id = "invalid-session-room-#{System.unique_integer([:positive])}"

    assert {:error, :invalid_nickname} =
             Sessions.enter(room_id, "no", "", presence_key: "presence-#{Ecto.UUID.generate()}")

    assert [] = Store.pending(room_id)
  end

  test "starts and restores one guest session without creating another visit" do
    room_id = "session-room-#{System.unique_integer([:positive])}"
    presence_key = "presence-#{Ecto.UUID.generate()}"

    assert {:ok, %Session{} = started} =
             Sessions.enter(room_id, "session_guest", "", presence_key: presence_key)

    assert started.user == nil
    assert String.starts_with?(started.identity_key, "guest:")
    assert started.guest_identity_id

    assert {:ok, %Session{} = restored} =
             Sessions.restore(room_id, %{
               nickname: started.nickname,
               presence_key: "presence-#{Ecto.UUID.generate()}",
               session_id: started.session_id,
               resume_secret: started.resume_secret,
               identity_key: started.identity_key
             })

    assert restored.visit.id == started.visit.id
    assert restored.identity_key == started.identity_key
  end

  test "requires the registered user's password and preserves their identity" do
    room_id = "registered-session-room-#{System.unique_integer([:positive])}"
    nickname = "rs_#{System.unique_integer([:positive])}"

    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => nickname, "password" => "secret123"})

    assert {:error, :password_required} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    assert {:ok, %Session{} = session} =
             Sessions.enter(room_id, nickname, "secret123",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    assert session.user.id == user.id
    assert session.guest_identity_id == nil
    assert session.identity_key == "user:#{user.id}"
  end

  test "does not activate the same nickname twice while its connection is active" do
    room_id = "active-session-room-#{System.unique_integer([:positive])}"
    nickname = "active_guest"

    assert {:ok, session} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)

    assert {:error, :nickname_online} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    assert :ok = Sessions.leave(session, self())
  end

  test "keeps a nickname reserved during passive reconnect and releases it on restore" do
    room_id = "reconnect-session-room-#{System.unique_integer([:positive])}"
    nickname = "reconnect_guest"

    assert {:ok, session} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    assert :ok = Sessions.connection_lost(session, self())

    assert [%{identity_key: identity_key, nickname: ^nickname}] =
             Store.pending(room_id)

    assert {:error, :nickname_online} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    assert {:ok, restored} =
             Sessions.restore(room_id, %{
               nickname: nickname,
               presence_key: "presence-#{Ecto.UUID.generate()}",
               session_id: session.session_id,
               resume_secret: session.resume_secret,
               identity_key: identity_key
             })

    connect(restored)

    assert [] = Store.pending(room_id)
  end

  test "keeps a hidden mobile session reconnectable for five minutes" do
    room_id = "hidden-session-room-#{System.unique_integer([:positive])}"

    assert {:ok, session} =
             Sessions.enter(room_id, "hidden_guest", "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    assert :ok =
             Store.touch(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               "hidden",
               now
             )

    assert {:ok, deadline} =
             Store.reconnect(
               session.session_id,
               session.identity_key,
               session.connection_epoch,
               now
             )

    assert DateTime.diff(deadline, now) == Store.hidden_grace_seconds()
  end

  test "keeps the session active when a stale connection closes after a restore" do
    room_id = "stale-connection-room-#{System.unique_integer([:positive])}"
    nickname = "restored_guest"

    assert {:ok, original} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    original = connect(original)

    assert {:ok, restored} =
             Sessions.restore(room_id, %{
               nickname: nickname,
               presence_key: "presence-#{Ecto.UUID.generate()}",
               session_id: original.session_id,
               resume_secret: original.resume_secret,
               identity_key: original.identity_key
             })

    restored = connect(restored)

    assert original.connection_epoch < restored.connection_epoch

    # The original socket can terminate after the restored one has connected.
    # Its stale event must not reserve the nick as reconnecting or hide the
    # still active connection.
    assert :ok = Sessions.connection_lost(original, self())
    assert [] = Store.pending(room_id)

    assert 1 ==
             room_id
             |> Chat.Chatlans.list_online()
             |> Enum.count(&(Map.get(&1, :identity_key) == original.identity_key))

    assert :ok = Sessions.leave(restored, self())
  end

  test "explicit leave prevents a stale connection loss from becoming reconnecting" do
    room_id = "explicit-session-room-#{System.unique_integer([:positive])}"

    assert {:ok, session} =
             Sessions.enter(room_id, "session_leaver", "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    assert :ok = Sessions.leave(session, self())
    assert :ok = Sessions.connection_lost(session, self())
    assert [] = Store.pending(room_id)
  end

  test "does not restore a session after its current connection explicitly leaves" do
    room_id = "ended-session-room-#{System.unique_integer([:positive])}"

    assert {:ok, session} =
             Sessions.enter(room_id, "ended_session", "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    assert :ok = Sessions.leave(session, self())

    assert {:error, :session_ended} =
             Sessions.restore(room_id, %{
               nickname: session.nickname,
               presence_key: "presence-#{Ecto.UUID.generate()}",
               session_id: session.session_id,
               resume_secret: session.resume_secret,
               identity_key: session.identity_key
             })
  end

  test "explicit leave ends a reconnecting session and cancels its grace period" do
    room_id = "leave-during-reconnect-room-#{System.unique_integer([:positive])}"

    assert {:ok, session} =
             Sessions.enter(room_id, "reconnecting_leaver", "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    assert :ok = Sessions.connection_lost(session, self())
    assert [_pending] = Store.pending(room_id)

    assert :ok = Sessions.leave(session, self())
    assert [] = Store.pending(room_id)
  end

  test "treats repeated explicit leave as one domain transition and allows a new session" do
    room_id = "idempotent-leave-room-#{System.unique_integer([:positive])}"
    nickname = "idempotent_guest"
    :ok = Messages.subscribe(room_id)

    assert {:ok, session} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    session = connect(session)
    assert :ok = Sessions.leave(session, self())
    assert_receive {:message_created, %{body: "из чата выходит " <> ^nickname}}

    assert :ok = Sessions.leave(session, self())
    refute_receive {:message_created, %{body: "из чата выходит " <> ^nickname}}, 30

    assert {:ok, new_session} =
             Sessions.enter(room_id, nickname, "",
               presence_key: "presence-#{Ecto.UUID.generate()}"
             )

    assert new_session.session_id != session.session_id
  end

  defp connect(session) do
    assert {:ok, _ref, connected} =
             Sessions.connect(session, self(), %{
               nickname: session.nickname,
               registered?: not is_nil(session.user),
               session_id: session.session_id,
               identity_key: session.identity_key
             })

    connected
  end
end
