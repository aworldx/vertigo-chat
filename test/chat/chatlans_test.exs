# Назначение файла: тесты контекста Chat.Chatlans и его Presence/настроек чатлан.
defmodule Chat.ChatlansTest do
  use Chat.DataCase, async: true

  alias Chat.Chatlans
  alias Chat.Messages

  test "normalizes nicknames" do
    assert Chatlans.normalize_nickname("  Вася_123  ", "fallback") == "Вася_123"
    assert Chatlans.normalize_nickname("no", "fallback") == "fallback"
    assert Chatlans.normalize_nickname("bad space", "fallback") == "fallback"
  end

  test "broadcasts transient typing state to the room" do
    room_id = "typing-room"
    Phoenix.PubSub.subscribe(Chat.PubSub, Messages.room_topic(room_id))

    assert :ok = Chatlans.broadcast_typing(room_id, "peer-alice", "alice", true)
    assert_receive {:typing_changed, "peer-alice", "alice", true}

    assert :ok = Chatlans.broadcast_typing(room_id, "peer-alice", "alice", false)
    assert_receive {:typing_changed, "peer-alice", "alice", false}
  end

  test "tracks, updates, lists and untracks online chatlans" do
    room_id = "presence-test"
    presence_key = Chatlans.guest_presence_key()

    Phoenix.PubSub.subscribe(Chat.PubSub, Messages.room_topic(room_id))

    assert {:ok, _ref} =
             Chatlans.track(self(), room_id, presence_key, %{
               nickname: "alice",
               registered?: true,
               theme_id: "dark",
               appearance: %{
                 "dark" => %{"nickname_color" => "#00ff88", "text_color" => "#3366aa"},
                 "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
               }
             })

    assert_receive %Phoenix.Socket.Broadcast{event: "presence_diff"}

    assert {:error, :nickname_online} =
             Chatlans.ensure_nickname_available(room_id, "alice")

    assert :ok = Chatlans.ensure_nickname_available(room_id, "alice", presence_key)

    assert :ok = Chatlans.ensure_nickname_available(room_id, "bob")
    assert {:error, :nickname_online} = Chatlans.ensure_nickname_available(room_id, "Хичкок")

    assert %{nickname: "Хичкок", bot?: true, peer_id: "bot-hitchcock"} =
             Enum.find(Chatlans.list_online(room_id), &Map.get(&1, :bot?, false))

    assert [
             %{
               nickname: "alice",
               registered?: true,
               theme_id: "dark",
               appearance: %{
                 "dark" => %{"nickname_color" => "#00ff88", "text_color" => "#3366aa"},
                 "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
               }
             }
           ] = human_chatlans(room_id)

    assert {:ok, _ref} =
             Chatlans.update(self(), room_id, presence_key, %{
               nickname: "alice",
               registered?: true,
               theme_id: "dark",
               appearance: %{
                 "dark" => %{"nickname_color" => "#cc2255", "text_color" => "#33aa77"},
                 "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
               }
             })

    assert [
             %{
               nickname: "alice",
               registered?: true,
               theme_id: "dark",
               appearance: %{
                 "dark" => %{"nickname_color" => "#cc2255", "text_color" => "#33aa77"},
                 "light" => %{"nickname_color" => "#9a3412", "text_color" => "#1f2937"}
               }
             }
           ] = human_chatlans(room_id)

    assert :ok = Chatlans.untrack(self(), room_id, presence_key)
    assert [] = human_chatlans(room_id)
    assert :ok = Chatlans.ensure_nickname_available(room_id, "alice")
  end

  test "restores a session with its previous presence key without duplicating its nickname" do
    room_id = "restoration-test"
    presence_key = Chatlans.guest_presence_key()

    assert {:ok, _ref} =
             Chatlans.track(self(), room_id, presence_key, %{
               nickname: "returning",
               registered?: false
             })

    assert {:ok, %{nickname: "returning", presence_key: ^presence_key}} =
             Chatlans.restore_session(
               room_id,
               " returning ",
               Chatlans.guest_presence_key(),
               presence_key
             )

    assert {:error, :nickname_online} =
             Chatlans.restore_session(room_id, "returning", Chatlans.guest_presence_key(), nil)

    assert {:ok, %{presence_key: current_key}} =
             Chatlans.restore_session(room_id, "another", "presence-current", "not-a-key")

    assert current_key == "presence-current"
  end

  defp human_chatlans(room_id) do
    Enum.reject(Chatlans.list_online(room_id), &Map.get(&1, :bot?, false))
  end
end
