# Назначение файла: тесты правил, временных анонсов и адресного сигналинга P2P-медиа.
defmodule Chat.MediaSharesTest do
  use ExUnit.Case, async: true

  alias Chat.Accounts.User
  alias Chat.MediaShares
  alias Chat.Messages
  alias Chat.Security.Subject

  defp user_and_subject do
    id = System.unique_integer([:positive])
    {%User{id: id, nickname: "alice"}, Subject.guest(nil, "test") |> Subject.with_actor(id)}
  end

  defp valid_attrs do
    %{
      "share_id" => Ecto.UUID.generate(),
      "name" => "photo.png",
      "type" => "image/png",
      "size" => 42_000,
      "theme_id" => "vertigo",
      "appearance" => %{}
    }
  end

  test "registered user announces metadata without storing file bytes" do
    room_id = "images-#{System.unique_integer([:positive])}"
    sender_peer = "presence-Sender_123"
    {user, subject} = user_and_subject()
    attrs = valid_attrs()

    :ok = Messages.subscribe(room_id)

    assert {:ok, announcement} =
             MediaShares.announce(user, room_id, sender_peer, attrs, subject)

    assert announcement.kind == :image
    assert announcement.author == "alice"
    assert announcement.share_id == attrs["share_id"]
    assert announcement.size == 42_000
    refute Map.has_key?(announcement, :bytes)
    assert_receive {:media_announced, ^announcement}
  end

  test "guest and mismatched trusted subject cannot announce an image" do
    room_id = "images-#{System.unique_integer([:positive])}"
    attrs = valid_attrs()
    guest = Subject.guest(nil, "guest")
    user = %User{id: 10, nickname: "alice"}

    assert {:error, :registration_required} =
             MediaShares.announce(nil, room_id, "presence-Sender_123", attrs, guest)

    assert {:error, :registration_required} =
             MediaShares.announce(user, room_id, "presence-Sender_123", attrs, guest)
  end

  test "validates image metadata on the backend" do
    room_id = "images-#{System.unique_integer([:positive])}"
    {user, subject} = user_and_subject()

    assert {:error, :invalid_content_type} =
             MediaShares.announce(
               user,
               room_id,
               "presence-Sender_123",
               %{valid_attrs() | "type" => "text/html"},
               subject
             )

    assert {:error, :invalid_image_size} =
             MediaShares.announce(
               user,
               room_id,
               "presence-Sender_123",
               %{valid_attrs() | "size" => MediaShares.max_image_size() + 1},
               subject
             )

    assert {:error, :invalid_media} =
             MediaShares.announce(user, room_id, "presence-Sender_123", %{}, subject)

    assert {:error, :invalid_file_name} =
             MediaShares.announce(
               user,
               room_id,
               "presence-Sender_123",
               %{valid_attrs() | "name" => 123},
               subject
             )

    assert {:error, :invalid_peer} = MediaShares.subscribe_peer(room_id, nil)
  end

  test "limits repeated image announcements from one registered user" do
    room_id = "images-#{System.unique_integer([:positive])}"
    {user, subject} = user_and_subject()

    for _index <- 1..3 do
      assert {:ok, _announcement} =
               MediaShares.announce(
                 user,
                 room_id,
                 "presence-Sender_123",
                 valid_attrs(),
                 subject
               )
    end

    assert {:error, :rate_limited} =
             MediaShares.announce(
               user,
               room_id,
               "presence-Sender_123",
               valid_attrs(),
               subject
             )
  end

  test "announces audio metadata with a larger size limit and without relay fallback" do
    room_id = "audio-#{System.unique_integer([:positive])}"
    sender_peer = "presence-Sender_123"
    requester_peer = "presence-Viewer_456"
    {user, subject} = user_and_subject()

    attrs = %{
      valid_attrs()
      | "name" => "track.mp3",
        "type" => "audio/mpeg",
        "size" => 12_000_000
    }

    assert {:ok, announcement} =
             MediaShares.announce(user, room_id, sender_peer, attrs, subject)

    assert announcement.kind == :audio

    assert :ok =
             MediaShares.request_media(room_id, requester_peer, "viewer", attrs["share_id"])

    assert {:error, :relay_unavailable} =
             MediaShares.request_relay(room_id, requester_peer, "viewer", attrs["share_id"])

    assert {:error, :invalid_audio_size} =
             MediaShares.announce(
               user,
               room_id,
               sender_peer,
               %{
                 attrs
                 | "share_id" => Ecto.UUID.generate(),
                   "size" => MediaShares.max_audio_size() + 1
               },
               subject
             )
  end

  test "relays WebRTC signals only between the owner and a requesting peer" do
    room_id = "images-#{System.unique_integer([:positive])}"
    sender_peer = "presence-Sender_123"
    requester_peer = "presence-Viewer_456"
    stranger_peer = "presence-Stranger_789"
    {user, subject} = user_and_subject()
    attrs = valid_attrs()

    :ok = MediaShares.subscribe_peer(room_id, sender_peer)
    :ok = MediaShares.subscribe_peer(room_id, requester_peer)

    assert {:ok, _announcement} =
             MediaShares.announce(user, room_id, sender_peer, attrs, subject)

    assert :ok =
             MediaShares.request_media(room_id, requester_peer, "viewer", attrs["share_id"])

    assert_receive {:media_signal, %{kind: "request", from: ^requester_peer, share_id: share_id}}

    assert share_id == attrs["share_id"]

    offer = %{
      "share_id" => attrs["share_id"],
      "kind" => "offer",
      "payload" => %{"type" => "offer", "sdp" => "v=0\r\n"}
    }

    assert :ok =
             MediaShares.relay_signal(room_id, requester_peer, sender_peer, offer)

    assert_receive {:media_signal, %{kind: "offer", from: ^requester_peer}}

    assert {:error, :signal_not_allowed} =
             MediaShares.relay_signal(room_id, stranger_peer, sender_peer, offer)

    candidate = %{
      "share_id" => attrs["share_id"],
      "kind" => "candidate",
      "payload" => %{
        "candidate" => "candidate:1 1 UDP 1 127.0.0.1 9999 typ host",
        "sdpMid" => "0",
        "sdpMLineIndex" => 0
      }
    }

    assert :ok =
             MediaShares.relay_signal(room_id, requester_peer, sender_peer, candidate)

    assert_receive {:media_signal,
                    %{kind: "candidate", payload: %{"sdpMid" => "0", "sdpMLineIndex" => 0}}}

    assert {:error, :invalid_signal} =
             MediaShares.relay_signal(
               room_id,
               requester_peer,
               sender_peer,
               %{candidate | "payload" => %{"candidate" => 42}}
             )

    assert {:error, :invalid_signal} =
             MediaShares.relay_signal(
               room_id,
               requester_peer,
               sender_peer,
               %{offer | "payload" => %{"type" => "answer", "sdp" => "v=0"}}
             )

    assert {:error, :invalid_share_id} =
             MediaShares.relay_signal(
               room_id,
               requester_peer,
               sender_peer,
               Map.delete(offer, "share_id")
             )

    assert {:error, :invalid_share_id} =
             MediaShares.relay_signal(
               room_id,
               requester_peer,
               sender_peer,
               %{offer | "share_id" => 42}
             )

    assert :ok =
             MediaShares.request_relay(room_id, requester_peer, "viewer", attrs["share_id"])

    assert_receive {:media_signal,
                    %{kind: "relay_request", from: ^requester_peer, share_id: ^share_id}}

    encoded_chunk = Base.encode64(:binary.copy(<<1>>, MediaShares.relay_chunk_size()))

    relay_attrs = %{
      "share_id" => attrs["share_id"],
      "index" => 0,
      "total" => 3,
      "media_chunk" => encoded_chunk
    }

    assert :ok =
             MediaShares.relay_chunk(
               user,
               subject,
               room_id,
               sender_peer,
               requester_peer,
               relay_attrs
             )

    assert_receive {:media_signal,
                    %{
                      kind: "relay_chunk",
                      from: ^sender_peer,
                      index: 0,
                      total: 3,
                      media_chunk: ^encoded_chunk
                    }}

    assert {:error, :invalid_relay_chunk} =
             MediaShares.relay_chunk(
               user,
               subject,
               room_id,
               sender_peer,
               requester_peer,
               relay_attrs
             )

    assert {:error, :registration_required} =
             MediaShares.relay_chunk(
               nil,
               Subject.guest(nil, "guest"),
               room_id,
               sender_peer,
               requester_peer,
               relay_attrs
             )
  end
end
