# Назначение файла: тесты отложенного объявления выхода при обрывах соединения.
defmodule Chat.Chatlans.DepartureNotifierTest do
  use Chat.DataCase, async: false

  alias Chat.Chatlans.DepartureNotifier
  alias Chat.Messages

  test "cancels a pending departure when the session reconnects" do
    notifier = start_supervised!({DepartureNotifier, name: nil, delay: 10})
    room_id = "reconnect-room"
    session_id = Ecto.UUID.generate()
    :ok = Messages.subscribe(room_id)

    assert :ok = DepartureNotifier.schedule(room_id, "returning", session_id, server: notifier)
    assert :ok = DepartureNotifier.cancel(room_id, session_id, server: notifier)

    refute_receive {:message_created, %{body: "из чата выходит returning"}}, 30
  end

  test "announces a departure after the reconnect grace period expires" do
    notifier = start_supervised!({DepartureNotifier, name: nil, delay: 0})
    room_id = "departure-room"
    session_id = Ecto.UUID.generate()
    :ok = Messages.subscribe(room_id)

    assert :ok = DepartureNotifier.schedule(room_id, "offline", session_id, server: notifier)
    assert_receive {:message_created, %{body: "из чата выходит offline"}}
  end

  test "does not announce a passive connection loss" do
    notifier = start_supervised!({DepartureNotifier, name: nil, delay: 0})
    room_id = "passive-disconnect-room"
    identity_key = "guest:" <> Ecto.UUID.generate()
    :ok = Messages.subscribe(room_id)

    assert :ok =
             DepartureNotifier.schedule(room_id, "temporarily_offline", identity_key,
               announce?: false,
               server: notifier
             )

    refute_receive {:message_created, %{body: "из чата выходит temporarily_offline"}}, 30
  end

  test "does not mark an explicitly exited chatlan as reconnecting" do
    notifier = start_supervised!({DepartureNotifier, name: nil, delay: 100})
    room_id = "explicit-exit-room"
    identity_key = "guest:" <> Ecto.UUID.generate()

    assert :ok =
             DepartureNotifier.announce_now(room_id, "left_on_purpose", identity_key,
               server: notifier
             )

    assert :ok =
             DepartureNotifier.schedule(room_id, "left_on_purpose", identity_key,
               announce?: false,
               server: notifier
             )

    assert [] = DepartureNotifier.pending(room_id, server: notifier)
  end
end
