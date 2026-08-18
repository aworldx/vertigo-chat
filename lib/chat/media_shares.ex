# Назначение файла: правила P2P-медиа, временные анонсы и адресный WebRTC-сигналинг.
defmodule Chat.MediaShares do
  @moduledoc """
  Управляет метаданными P2P-изображений и аудио, WebRTC-сигналингом и fallback картинок.
  Файлы в БД и файловой системе не сохраняются.
  """

  alias Chat.Accounts.User
  alias Chat.Appearance
  alias Chat.MediaShares.Registry
  alias Chat.Security
  alias Chat.Security.Subject
  alias Chat.Themes

  @max_image_size 5_000_000
  @max_audio_size 50_000_000
  @max_file_name_length 120
  @image_types ~w(image/jpeg image/png image/webp)
  @audio_types ~w(audio/mpeg audio/mp3 audio/x-mp3 audio/ogg audio/wav audio/x-wav audio/mp4 audio/x-m4a audio/aac)
  @share_id_pattern ~r/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i
  @peer_id_pattern ~r/\Apresence-[A-Za-z0-9_-]{8,64}\z/
  @signal_kinds ~w(offer answer candidate)
  @max_sdp_length 30_000
  @max_candidate_length 4_000
  @relay_chunk_size 18_000
  @max_encoded_chunk_size 24_000

  def subscribe_peer(room_id, peer_id) do
    with :ok <- validate_peer_id(peer_id) do
      Phoenix.PubSub.subscribe(Chat.PubSub, peer_topic(room_id, peer_id))
    end
  end

  def announce(
        %User{id: user_id, nickname: author},
        room_id,
        peer_id,
        attrs,
        %Subject{actor_id: user_id} = subject
      ) do
    with :ok <- validate_peer_id(peer_id),
         {:ok, metadata} <- validate_metadata(attrs),
         :ok <- allow_media_share(subject) do
      announcement = %{
        id: "media-#{metadata.share_id}",
        kind: metadata.kind,
        room_id: room_id,
        share_id: metadata.share_id,
        sender_peer: peer_id,
        author: author,
        name: metadata.name,
        content_type: metadata.content_type,
        size: metadata.size,
        theme_id: Themes.normalize_theme_id(attrs["theme_id"]),
        appearance: Appearance.normalize(attrs["appearance"] || %{}),
        at: current_time()
      }

      with :ok <- Registry.register(announcement) do
        :ok =
          Phoenix.PubSub.broadcast(
            Chat.PubSub,
            room_topic(room_id),
            {:media_announced, announcement}
          )

        {:ok, announcement}
      end
    end
  end

  def announce(_user, _room_id, _peer_id, _attrs, %Subject{}),
    do: {:error, :registration_required}

  def request_media(room_id, requester_peer, requester_nickname, share_id) do
    with :ok <- validate_peer_id(requester_peer),
         :ok <- validate_share_id(share_id),
         {:ok, announcement} <- Registry.request(share_id, room_id, requester_peer) do
      signal = %{
        kind: "request",
        share_id: share_id,
        from: requester_peer,
        requester: requester_nickname
      }

      broadcast_signal(room_id, announcement.sender_peer, signal)
      :ok
    end
  end

  def request_relay(room_id, requester_peer, requester_nickname, share_id) do
    with :ok <- validate_peer_id(requester_peer),
         :ok <- validate_share_id(share_id),
         {:ok, announcement} <- Registry.request(share_id, room_id, requester_peer) do
      signal = %{
        kind: "relay_request",
        share_id: share_id,
        from: requester_peer,
        requester: requester_nickname
      }

      broadcast_signal(room_id, announcement.sender_peer, signal)
      :ok
    end
  end

  def relay_signal(room_id, from_peer, target_peer, attrs) do
    with :ok <- validate_peer_id(from_peer),
         :ok <- validate_peer_id(target_peer),
         {:ok, share_id} <- fetch_share_id(attrs),
         {:ok, kind, payload} <- validate_signal(attrs),
         :ok <- Registry.authorize(share_id, room_id, from_peer, target_peer) do
      broadcast_signal(room_id, target_peer, %{
        kind: kind,
        share_id: share_id,
        from: from_peer,
        payload: payload
      })

      :ok
    end
  end

  def relay_chunk(
        %User{id: user_id},
        %Subject{actor_id: user_id},
        room_id,
        from_peer,
        target_peer,
        attrs
      ) do
    with :ok <- validate_peer_id(from_peer),
         :ok <- validate_peer_id(target_peer),
         {:ok, share_id} <- fetch_share_id(attrs),
         {:ok, index, total, encoded, decoded_size} <- validate_relay_chunk(attrs),
         :ok <-
           Registry.authorize_relay_chunk(
             share_id,
             room_id,
             from_peer,
             target_peer,
             index,
             total,
             decoded_size,
             @relay_chunk_size
           ) do
      broadcast_signal(room_id, target_peer, %{
        kind: "relay_chunk",
        share_id: share_id,
        from: from_peer,
        index: index,
        total: total,
        media_chunk: encoded
      })

      :ok
    end
  end

  def relay_chunk(_user, %Subject{}, _room_id, _from_peer, _target_peer, _attrs),
    do: {:error, :registration_required}

  def close_peer(room_id, peer_id) do
    if valid_peer_id?(peer_id), do: Registry.close_peer(room_id, peer_id)
    :ok
  end

  def max_image_size, do: @max_image_size
  def max_audio_size, do: @max_audio_size
  def accepted_types, do: @image_types ++ @audio_types
  def relay_chunk_size, do: @relay_chunk_size

  def ice_servers do
    Application.get_env(:chat, __MODULE__, [])
    |> Keyword.get(:ice_servers, [%{urls: "stun:stun.cloudflare.com:3478"}])
  end

  defp validate_metadata(%{
         "share_id" => share_id,
         "name" => name,
         "type" => content_type,
         "size" => size
       }) do
    with :ok <- validate_share_id(share_id),
         {:ok, name} <- validate_file_name(name),
         {:ok, kind} <- validate_content_type(content_type),
         {:ok, size} <- validate_size(size, kind) do
      {:ok,
       %{
         share_id: share_id,
         kind: kind,
         name: name,
         content_type: content_type,
         size: size
       }}
    end
  end

  defp validate_metadata(_attrs), do: {:error, :invalid_media}

  defp allow_media_share(subject) do
    case Security.allow_media_share(subject) do
      :ok -> :ok
      {:error, {:rate_limited, _retry_after_ms}} -> {:error, :rate_limited}
    end
  end

  defp validate_file_name(name) when is_binary(name) do
    name =
      name
      |> String.replace(~r/[\x00-\x1F\x7F]/u, "")
      |> String.split(~r{[/\\]})
      |> List.last()
      |> String.trim()

    if name != "" && String.length(name) <= @max_file_name_length do
      {:ok, name}
    else
      {:error, :invalid_file_name}
    end
  end

  defp validate_file_name(_name), do: {:error, :invalid_file_name}

  defp validate_content_type(content_type) when content_type in @image_types, do: {:ok, :image}
  defp validate_content_type(content_type) when content_type in @audio_types, do: {:ok, :audio}
  defp validate_content_type(_content_type), do: {:error, :invalid_content_type}

  defp validate_size(size, :image)
       when is_integer(size) and size > 0 and size <= @max_image_size,
       do: {:ok, size}

  defp validate_size(size, :audio)
       when is_integer(size) and size > 0 and size <= @max_audio_size,
       do: {:ok, size}

  defp validate_size(_size, :image), do: {:error, :invalid_image_size}
  defp validate_size(_size, :audio), do: {:error, :invalid_audio_size}

  defp fetch_share_id(%{"share_id" => share_id}) do
    case validate_share_id(share_id) do
      :ok -> {:ok, share_id}
      error -> error
    end
  end

  defp fetch_share_id(_attrs), do: {:error, :invalid_share_id}

  defp validate_signal(%{"kind" => kind, "payload" => payload}) when kind in @signal_kinds do
    case kind do
      kind when kind in ~w(offer answer) -> validate_description(kind, payload)
      "candidate" -> validate_candidate(payload)
    end
  end

  defp validate_signal(_attrs), do: {:error, :invalid_signal}

  defp validate_description(kind, %{"type" => kind, "sdp" => sdp})
       when is_binary(sdp) and byte_size(sdp) <= @max_sdp_length do
    {:ok, kind, %{"type" => kind, "sdp" => sdp}}
  end

  defp validate_description(_kind, _payload), do: {:error, :invalid_signal}

  defp validate_candidate(%{"candidate" => candidate} = payload)
       when is_binary(candidate) and byte_size(candidate) <= @max_candidate_length do
    normalized = %{
      "candidate" => candidate,
      "sdpMid" => string_or_nil(payload["sdpMid"]),
      "sdpMLineIndex" => integer_or_nil(payload["sdpMLineIndex"])
    }

    {:ok, "candidate", normalized}
  end

  defp validate_candidate(_payload), do: {:error, :invalid_signal}

  defp validate_relay_chunk(%{
         "index" => index,
         "total" => total,
         "media_chunk" => encoded
       })
       when is_integer(index) and is_integer(total) and total > 0 and is_binary(encoded) and
              byte_size(encoded) <= @max_encoded_chunk_size do
    case Base.decode64(encoded) do
      {:ok, decoded} when byte_size(decoded) > 0 and byte_size(decoded) <= @relay_chunk_size ->
        {:ok, index, total, encoded, byte_size(decoded)}

      _invalid ->
        {:error, :invalid_relay_chunk}
    end
  end

  defp validate_relay_chunk(_attrs), do: {:error, :invalid_relay_chunk}

  defp string_or_nil(value) when is_binary(value), do: String.slice(value, 0, 64)
  defp string_or_nil(_value), do: nil

  defp integer_or_nil(value) when is_integer(value) and value >= 0 and value <= 65_535, do: value
  defp integer_or_nil(_value), do: nil

  defp validate_share_id(share_id) when is_binary(share_id) do
    if Regex.match?(@share_id_pattern, share_id),
      do: :ok,
      else: {:error, :invalid_share_id}
  end

  defp validate_share_id(_share_id), do: {:error, :invalid_share_id}

  defp validate_peer_id(peer_id) do
    if valid_peer_id?(peer_id), do: :ok, else: {:error, :invalid_peer}
  end

  defp valid_peer_id?(peer_id) when is_binary(peer_id),
    do: Regex.match?(@peer_id_pattern, peer_id)

  defp valid_peer_id?(_peer_id), do: false

  defp broadcast_signal(room_id, target_peer, signal) do
    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      peer_topic(room_id, target_peer),
      {:media_signal, signal}
    )
  end

  defp room_topic(room_id), do: "room:#{room_id}"
  defp peer_topic(room_id, peer_id), do: "media-peer:#{room_id}:#{peer_id}"
  defp current_time, do: Calendar.strftime(Time.utc_now(), "%H:%M:%S")
end
