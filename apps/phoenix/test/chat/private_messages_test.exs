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

    connect(room_id, sender_peer, attrs.("alice"))
    connect(room_id, recipient_peer, attrs.("bob"))

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

  test "rejects malformed input and identifies private-message syntax safely" do
    subject = Subject.internal(:invalid_private_message)

    assert {:error, :invalid_message} =
             PrivateMessages.send_private_message(nil, "sender", "room", %{}, subject)

    assert {:error, :invalid_message} = PrivateMessages.parse(nil)
    assert PrivateMessages.private_syntax?("  ^bob привет")
    refute PrivateMessages.private_syntax?("bob, привет")
    refute PrivateMessages.private_syntax?(nil)
  end

  test "rejects messages addressed to the sender" do
    room_id = "validation-#{System.unique_integer([:positive])}"
    sender_peer = "sender-#{System.unique_integer([:positive])}"
    attrs = Chatlans.appearance_attrs("alice", "vertigo", Appearance.default())
    subject = Subject.internal({room_id, sender_peer})

    connect(room_id, sender_peer, attrs)

    assert {:error, :self_recipient} =
             PrivateMessages.send_private_message(
               "alice",
               sender_peer,
               room_id,
               %{"body" => "^alice нельзя самому себе"},
               subject
             )
  end

  defp connect(room_id, peer, attrs) do
    {:ok, session} = Chat.Sessions.enter(room_id, attrs.nickname, "", presence_key: peer)

    attrs =
      Map.merge(attrs, %{session_id: session.session_id, identity_key: session.identity_key})

    assert {:ok, _, _} = Chat.Sessions.connect(session, self(), attrs)
  end
end
