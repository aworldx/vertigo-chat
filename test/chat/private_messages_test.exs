# Назначение файла: тесты эфемерной адресной доставки личных сообщений.
defmodule Chat.PrivateMessagesTest do
  use Chat.DataCase, async: false

  alias Chat.Appearance
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.PrivateMessages
  alias Chat.Security.Subject

  test "delivers only through peer topics and never through the public room topic" do
    room_id = "private-#{System.unique_integer([:positive])}"
    sender_peer = "sender-#{System.unique_integer([:positive])}"
    recipient_peer = "recipient-#{System.unique_integer([:positive])}"

    attrs = fn nickname ->
      Chatlans.appearance_attrs(nickname, "vertigo", Appearance.default())
    end

    assert {:ok, _ref} = Chatlans.track(self(), room_id, sender_peer, attrs.("alice"))
    assert {:ok, _ref} = Chatlans.track(self(), room_id, recipient_peer, attrs.("bob"))

    :ok = Messages.subscribe(room_id)
    :ok = PrivateMessages.subscribe(sender_peer)
    :ok = PrivateMessages.subscribe(recipient_peer)

    assert {:ok, message} =
             PrivateMessages.send_private_message(
               "alice",
               sender_peer,
               room_id,
               %{"body" => "^bob, только для двоих"},
               Subject.internal({room_id, sender_peer})
             )

    assert message.kind == :private
    assert message.body == "только для двоих"
    assert_receive {:private_message_received, ^message}
    assert_receive {:private_message_received, ^message}
    refute_receive {:message_created, _message}
    assert [%{author: "system"}] = Messages.list_recent_messages(room_id)
  end

  test "parses both supported forms and rejects a message without recipient" do
    assert {:ok, "bob", "секрет"} = PrivateMessages.parse(%{"body" => "^bob, секрет"})
    assert {:ok, "bob", "секрет"} = PrivateMessages.parse(%{"body" => "^bob секрет"})
    assert {:ok, "bob", "секрет"} = PrivateMessages.parse(%{"body" => "bob, секрет"})

    assert {:error, :private_recipient_required} =
             PrivateMessages.parse(%{"body" => "обычный текст"})
  end
end
