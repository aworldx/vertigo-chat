# Назначение файла: тесты контекста Chat.Messages и его realtime-событий.
defmodule Chat.MessagesTest do
  use Chat.DataCase, async: false

  alias Chat.Messages
  alias Chat.Messages.Registry
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

    test "returns an existing message without broadcasting it again when retried" do
      room_id = "idempotent-room"
      client_id = Ecto.UUID.generate()
      :ok = Messages.subscribe(room_id)

      assert {:ok, message} =
               Messages.send_public_message("alice", room_id, %{
                 "body" => "сообщение после обрыва",
                 "client_id" => client_id
               })

      assert_receive {:message_created, ^message}

      assert {:ok, repeated_message} =
               Messages.send_public_message("alice", room_id, %{
                 "body" => "сообщение после обрыва",
                 "client_id" => client_id
               })

      assert repeated_message.id == message.id
      refute_receive {:message_created, _message}
    end

    test "lists only messages newer than a cursor" do
      room_id = "cursor-room"

      assert {:ok, first} = Messages.send_public_message("alice", room_id, %{"body" => "первое"})
      assert {:ok, second} = Messages.send_public_message("alice", room_id, %{"body" => "второе"})
      assert {:ok, third} = Messages.send_public_message("alice", room_id, %{"body" => "третье"})

      assert [^second, ^third] = Messages.list_messages_after(room_id, first.id)
    end

    test "extracts only a known addressed nickname from anywhere in a message" do
      assert {:ok, message} =
               Messages.send_public_message("alice", "private-room", %{
                 "body" => "привет, bob, как дела?",
                 "recipient_nicknames" => ["bob"]
               })

      assert message.recipient == "bob"

      assert {:ok, ordinary_message} =
               Messages.send_public_message("alice", "another-room", %{
                 "body" => "слово, которое не является ником",
                 "recipient_nicknames" => ["bob"]
               })

      assert ordinary_message.recipient == nil
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

  describe "send_gif/5" do
    test "broadcasts a trusted GIF as a persistent public message" do
      room_id = "gif-room"
      :ok = Messages.subscribe(room_id)

      assert {:ok, message} =
               Messages.send_gif(
                 "alice",
                 room_id,
                 %{
                   title: "Аплодисменты",
                   url: "https://gifsnap.com/api/v1/media/animated-gif"
                 },
                 %{},
                 Subject.internal(:gif_test)
               )

      assert message.kind == :gif
      assert message.media_url == "https://gifsnap.com/api/v1/media/animated-gif"
      assert_receive {:message_created, ^message}
      assert [stored] = Messages.list_recent_messages(room_id)
      assert stored.kind == :gif
      assert stored.media_url == message.media_url
    end

    test "rejects GIFs from an untrusted media host" do
      assert {:error, :invalid_gif} =
               Messages.send_gif(
                 "alice",
                 "gif-room",
                 %{title: "Unsafe", url: "https://example.com/gif"},
                 %{},
                 Subject.internal(:unsafe_gif_test)
               )
    end
  end

  describe "send_music/5" do
    test "broadcasts a selected track as a persistent public message" do
      room_id = "music-room"
      :ok = Messages.subscribe(room_id)

      assert {:ok, message} =
               Messages.send_music(
                 "alice",
                 room_id,
                 %{
                   artist: "Bakr",
                   title: "Привет",
                   duration: "2:35",
                   audio_url: "https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3",
                   source_url: "https://mp3mn.net/t/165-bakr_privet/"
                 },
                 %{},
                 Subject.internal(:music_test)
               )

      assert message.kind == :music
      assert message.media_artist == "Bakr"
      assert message.media_duration == "2:35"
      assert_receive {:message_created, ^message}

      assert [stored] = Messages.list_recent_messages(room_id)
      assert stored.kind == :music
      assert stored.media_url == message.media_url
      assert stored.media_source_url == message.media_source_url
    end

    test "rejects tracks from an untrusted audio host" do
      assert {:error, :invalid_track} =
               Messages.send_music(
                 "alice",
                 "music-room",
                 %{
                   artist: "Unsafe",
                   title: "Track",
                   duration: "2:35",
                   audio_url: "https://example.com/file/track.mp3",
                   source_url: "https://mp3mn.net/t/unsafe/"
                 },
                 %{},
                 Subject.internal(:unsafe_music_test)
               )
    end
  end

  test "room_topic/1 returns the canonical realtime topic" do
    assert Messages.room_topic("lobby") == "room:lobby"
  end

  test "toggles a reaction and broadcasts the updated message" do
    room_id = "reactions-#{System.unique_integer([:positive])}"
    :ok = Messages.subscribe(room_id)

    assert {:ok, message} =
             Messages.send_public_message("alice", room_id, %{"body" => "react to me"})

    assert_receive {:message_created, ^message}

    assert {:ok, reacted} =
             Messages.toggle_reaction("bob", "peer-bob", room_id, to_string(message.id), "👍")

    assert MapSet.equal?(reacted.reactions["👍"], MapSet.new(["peer-bob"]))
    assert_receive {:message_reacted, ^reacted}

    assert {:ok, replaced} =
             Messages.toggle_reaction("bob", "peer-bob", room_id, to_string(message.id), "❤️")

    assert replaced.reactions["👍"] == nil
    assert MapSet.equal?(replaced.reactions["❤️"], MapSet.new(["peer-bob"]))
    assert_receive {:message_reacted, ^replaced}

    assert {:ok, unreacted} =
             Messages.toggle_reaction("bob", "peer-bob", room_id, to_string(message.id), "❤️")

    assert unreacted.reactions == %{}
    assert_receive {:message_reacted, ^unreacted}
  end

  test "rejects reactions to an own message and unsupported emoji" do
    room_id = "reaction-rules-#{System.unique_integer([:positive])}"
    assert {:ok, message} = Messages.send_public_message("alice", room_id, %{"body" => "mine"})

    assert {:error, :own_message} =
             Messages.toggle_reaction(
               "alice",
               "peer-alice",
               room_id,
               to_string(message.id),
               "❤️"
             )

    assert {:error, :invalid_reaction} =
             Messages.toggle_reaction(
               "bob",
               "peer-bob",
               room_id,
               to_string(message.id),
               "💩"
             )
  end

  test "list_recent_messages/1 returns the prototype welcome message" do
    room_id = "empty-history-#{System.unique_integer([:positive])}"
    assert [%{author: "system", body: body}] = Messages.list_recent_messages(room_id)
    assert body =~ "Добро пожаловать"
  end

  test "broadcasts presence events as system messages" do
    room_id = "presence-events-#{System.unique_integer([:positive])}"
    :ok = Messages.subscribe(room_id)

    assert {:ok, joined} = Messages.announce_presence("alice", room_id, :joined)
    assert joined.kind == :system
    assert joined.body == "в чат заходит alice"
    assert_receive {:message_created, ^joined}

    assert {:ok, left} = Messages.announce_presence("alice", room_id, :left)
    assert left.kind == :system
    assert left.body == "из чата выходит alice"
    assert_receive {:message_created, ^left}
    assert [^joined, ^left] = Messages.list_recent_messages(room_id)
  end

  test "keeps only the latest 30 public messages in chronological order" do
    room_id = "history-#{System.unique_integer([:positive])}"

    for index <- 1..31 do
      assert {:ok, _message} =
               Messages.send_public_message("author-#{index}", room_id, %{
                 "body" => "message #{index}"
               })
    end

    messages = Messages.list_recent_messages(room_id)

    assert length(messages) == 30
    assert Enum.map(messages, & &1.body) == Enum.map(2..31, &"message #{&1}")
  end

  test "loads public history from the database after the realtime cache is cleared" do
    room_id = "persistent-history-#{System.unique_integer([:positive])}"

    assert {:ok, sent} = Messages.send_public_message("alice", room_id, %{"body" => "останется"})
    :sys.replace_state(Registry, &Map.delete(&1, room_id))

    assert [%{id: message_id, body: "останется"}] = Messages.list_recent_messages(room_id)
    assert message_id == sent.id
  end

  test "restores persisted reactions with the message" do
    room_id = "persistent-reactions-#{System.unique_integer([:positive])}"
    assert {:ok, message} = Messages.send_public_message("alice", room_id, %{"body" => "реакция"})

    assert {:ok, _reacted} =
             Messages.toggle_reaction("bob", "peer-bob", room_id, to_string(message.id), "❤️")

    :sys.replace_state(Registry, &Map.delete(&1, room_id))

    assert [%{reactions: reactions}] = Messages.list_recent_messages(room_id)
    assert MapSet.equal?(reactions["❤️"], MapSet.new(["peer-bob"]))
  end
end
