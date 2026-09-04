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
end
