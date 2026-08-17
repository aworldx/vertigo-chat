# Назначение файла: тесты контекста Chat.Messages и его realtime-событий.
defmodule Chat.MessagesTest do
  use Chat.DataCase, async: true

  alias Chat.Messages
  alias Chat.Security.Subject

  describe "send_public_message/3" do
    test "broadcasts a trimmed message to the room topic" do
      room_id = "test-room"

      :ok = Messages.subscribe(room_id)

      assert {:ok, message} =
               Messages.send_public_message("alice", room_id, %{"body" => "  hello  "})

      assert message.author == "alice"
      assert message.body == "hello"
      assert message.recipient == nil
      assert_receive {:message_created, ^message}
    end

    test "extracts the addressed nickname from the beginning of a message" do
      assert {:ok, message} =
               Messages.send_public_message("alice", "private-room", %{
                 "body" => "bob, привет"
               })

      assert message.recipient == "bob"
    end

    test "broadcasts message colors" do
      room_id = "color-room"

      :ok = Messages.subscribe(room_id)

      assert {:ok, message} =
               Messages.send_public_message("alice", room_id, %{
                 "body" => "color text",
                 "theme_id" => "dark",
                 "appearance" => %{
                   "dark" => %{"nickname_color" => "#00FF88", "text_color" => "#3366AA"},
                   "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
                 }
               })

      assert message.appearance["dark"]["nickname_color"] == "#00ff88"
      assert message.appearance["dark"]["text_color"] == "#3366aa"
      assert_receive {:message_created, ^message}
    end

    test "falls back to default colors for invalid color params" do
      assert {:ok, message} =
               Messages.send_public_message("alice", "color-room", %{
                 "body" => "bad colors",
                 "theme_id" => "dark",
                 "appearance" => %{
                   "dark" => %{"nickname_color" => "red", "text_color" => "#nope"},
                   "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
                 }
               })

      assert message.appearance["dark"]["nickname_color"] == "#fcd34d"
      assert message.appearance["dark"]["text_color"] == "#e4e4e7"
    end

    test "broadcasts to the default lobby room" do
      :ok = Messages.subscribe()

      assert {:ok, message} = Messages.send_public_message("bob", %{"body" => "hello lobby"})

      assert message.author == "bob"
      assert message.body == "hello lobby"
      assert_receive {:message_created, ^message}
    end

    test "rejects empty messages" do
      assert {:error, :empty_body} =
               Messages.send_public_message("alice", "test-room", %{"body" => "   "})

      assert {:error, :invalid_message} =
               Messages.send_public_message("alice", "test-room", %{})
    end

    test "limits message length and rapid spam" do
      subject = Subject.internal({:test_sender, System.unique_integer([:positive])})

      assert {:error, :message_too_long} =
               Messages.send_public_message(
                 "alice",
                 "secure-room",
                 %{"body" => String.duplicate("я", Messages.max_body_length() + 1)},
                 subject
               )

      for index <- 1..3 do
        assert {:ok, _message} =
                 Messages.send_public_message(
                   "alice",
                   "secure-room",
                   %{"body" => "message #{index}"},
                   subject
                 )
      end

      assert {:error, :rate_limited} =
               Messages.send_public_message(
                 "alice",
                 "secure-room",
                 %{"body" => "spam"},
                 subject
               )
    end
  end

  test "room_topic/1 returns the canonical realtime topic" do
    assert Messages.room_topic("lobby") == "room:lobby"
  end

  test "list_recent_messages/1 returns the prototype welcome message" do
    assert [%{author: "system", body: body}] = Messages.list_recent_messages("lobby")
    assert body =~ "Добро пожаловать"
  end
end
