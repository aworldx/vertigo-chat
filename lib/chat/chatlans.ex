# Назначение файла: контекст чатлан, их Presence-состояния, онлайн-списка и гостевых настроек.
defmodule Chat.Chatlans do
  @moduledoc """
  Tracks chat participants and their public realtime appearance.
  """

  alias Chat.Appearance
  alias Chat.Accounts
  alias Chat.Bot
  alias Chat.Messages
  alias Chat.Chatlans.DepartureNotifier
  alias Chat.Presence
  alias Chat.Themes

  def guest_presence_key do
    "presence-" <> (:crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false))
  end

  def normalize_nickname(nickname, fallback) when is_binary(nickname) do
    nickname = String.trim(nickname)

    if Regex.match?(~r/\A[\p{L}\p{N}_-]{3,24}\z/u, nickname), do: nickname, else: fallback
  end

  def normalize_nickname(_nickname, fallback), do: fallback

  def list_online(room_id) do
    room_id
    |> Messages.room_topic()
    |> Presence.list()
    |> Enum.flat_map(fn {id, %{metas: metas}} ->
      for meta <- [List.last(metas)] do
        appearance = appearance_from(meta)
        theme_id = Map.get(meta, :theme_id, Themes.default_theme_id())

        %{
          id: "#{id}:#{meta.phx_ref}",
          peer_id: id,
          session_id: Map.get(meta, :session_id),
          nickname: meta.nickname,
          registered?: Map.get(meta, :registered?, false),
          rank: Map.get(meta, :rank),
          theme_id: theme_id,
          appearance: appearance
        }
      end
    end)
    |> Enum.uniq_by(&(&1.session_id || &1.peer_id))
    |> Kernel.++([Bot.chatlan()])
    |> Enum.sort_by(& &1.nickname)
  end

  def track(pid, room_id, presence_key, attrs) do
    Presence.track(pid, Messages.room_topic(room_id), presence_key, presence_meta(attrs))
  end

  def update(pid, room_id, presence_key, attrs) do
    Presence.update(pid, Messages.room_topic(room_id), presence_key, presence_meta(attrs))
  end

  def untrack(pid, room_id, presence_key) do
    Presence.untrack(pid, Messages.room_topic(room_id), presence_key)
  end

  def session_online?(room_id, session_id) when is_binary(room_id) and is_binary(session_id) do
    Enum.any?(list_online(room_id), &(Map.get(&1, :session_id) == session_id))
  end

  def session_online?(_room_id, _session_id), do: false

  def schedule_departure(room_id, nickname, session_id)
      when is_binary(room_id) and is_binary(nickname) and is_binary(session_id) do
    DepartureNotifier.schedule(room_id, nickname, session_id)
  end

  def cancel_scheduled_departure(room_id, session_id)
      when is_binary(room_id) and is_binary(session_id) do
    DepartureNotifier.cancel(room_id, session_id)
  end

  def announce_departure(room_id, nickname, session_id)
      when is_binary(room_id) and is_binary(nickname) and is_binary(session_id) do
    DepartureNotifier.announce_now(room_id, nickname, session_id)
  end

  def resolve_peer(room_id, nickname) when is_binary(nickname) do
    peers =
      room_id
      |> list_online()
      |> Enum.filter(&(&1.nickname == nickname))

    case peers do
      [%{peer_id: peer_id}] -> {:ok, peer_id}
      [] -> {:error, :recipient_offline}
      _duplicates -> {:error, :ambiguous_recipient}
    end
  end

  def ensure_nickname_available(room_id, nickname, current_peer_id \\ nil, session_id \\ nil)

  def ensure_nickname_available(room_id, nickname, current_peer_id, session_id)
      when is_binary(room_id) and is_binary(nickname) do
    if Enum.any?(list_online(room_id), fn chatlan ->
         chatlan.nickname == nickname and chatlan.peer_id != current_peer_id and
           (is_nil(session_id) or chatlan.session_id != session_id)
       end) do
      {:error, :nickname_online}
    else
      :ok
    end
  end

  def ensure_nickname_available(_room_id, _nickname, _current_peer_id, _session_id),
    do: {:error, :invalid_nickname}

  def restore_session(room_id, nickname, current_presence_key, stored_presence_key, opts \\ []) do
    nickname = normalize_nickname(nickname, nil)
    presence_key = restored_presence_key(current_presence_key, stored_presence_key)

    with nickname when not is_nil(nickname) <- nickname,
         false <- Keyword.get(opts, :guest?, false) and Accounts.registered_nickname?(nickname),
         :ok <- ensure_nickname_available(room_id, nickname, presence_key, opts[:session_id]) do
      {:ok, %{nickname: nickname, presence_key: presence_key}}
    else
      true -> {:error, :registered_nickname}
      {:error, reason} -> {:error, reason}
      _invalid -> {:error, :invalid_nickname}
    end
  end

  def broadcast_typing(room_id, peer_id, nickname, typing?)
      when is_binary(room_id) and is_binary(peer_id) and is_binary(nickname) and
             is_boolean(typing?) do
    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic(room_id),
      {:typing_changed, peer_id, nickname, typing?}
    )
  end

  def appearance_attrs(nickname, theme_id, appearance, opts \\ []) do
    theme_id = Themes.normalize_theme_id(theme_id)
    appearance = Appearance.normalize(appearance)

    %{
      nickname: normalize_nickname(nickname, nil),
      registered?: Keyword.get(opts, :registered?, false),
      rank: Keyword.get(opts, :rank),
      session_id: Keyword.get(opts, :session_id),
      theme_id: theme_id,
      appearance: appearance
    }
  end

  defp presence_meta(attrs) do
    theme_id = Map.get(attrs, :theme_id, Themes.default_theme_id()) |> Themes.normalize_theme_id()
    appearance = appearance_from(attrs)

    %{
      nickname: attrs.nickname,
      registered?: Map.get(attrs, :registered?, false),
      rank: Map.get(attrs, :rank),
      session_id: Map.get(attrs, :session_id),
      theme_id: theme_id,
      appearance: appearance
    }
  end

  defp appearance_from(attrs) do
    attrs
    |> Map.get(:appearance, Appearance.default())
    |> Appearance.normalize()
  end

  defp restored_presence_key(current_presence_key, "presence-" <> encoded = presence_key)
       when byte_size(encoded) in 8..64 do
    if Regex.match?(~r/\A[A-Za-z0-9_-]+\z/, encoded),
      do: presence_key,
      else: current_presence_key
  end

  defp restored_presence_key(current_presence_key, _stored_presence_key), do: current_presence_key
end
