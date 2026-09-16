# Назначение файла: контекст чатлан, их Presence-состояния, онлайн-списка и гостевых настроек.
defmodule Chat.Chatlans do
  @moduledoc """
  Tracks chat participants and their public realtime appearance.
  """

  alias Chat.Appearance
  alias Chat.Bot
  alias Chat.Messages
  alias Chat.Listening
  alias Chat.Presence
  alias Chat.Themes
  alias Chat.Sessions.Store

  def guest_presence_key do
    "presence-" <> (:crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false))
  end

  def normalize_nickname(nickname, fallback) when is_binary(nickname) do
    nickname = String.trim(nickname)

    if Regex.match?(~r/\A[\p{L}\p{N}_-]{3,24}\z/u, nickname), do: nickname, else: fallback
  end

  def normalize_nickname(_nickname, fallback), do: fallback

  def list_online(room_id) do
    sessions = Map.new(Store.live(room_id), &{&1.id, &1})

    online =
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
            identity_key: Map.get(meta, :identity_key),
            listening_track: Listening.track_for(room_id, Map.get(meta, :identity_key)),
            connection_epoch: Map.get(meta, :connection_epoch),
            nickname: meta.nickname,
            registered?: Map.get(meta, :registered?, false),
            rank: Map.get(meta, :rank),
            karma: Map.get(meta, :karma, 0),
            theme_id: theme_id,
            appearance: appearance
          }
        end
      end)
      |> Enum.filter(fn peer ->
        case Map.get(sessions, peer.session_id) do
          nil -> false
          session -> session.status == "active" and session.generation == peer.connection_epoch
        end
      end)
      |> Enum.uniq_by(&(&1.identity_key || &1.session_id || &1.peer_id))

    reconnecting =
      sessions
      |> Map.values()
      |> Enum.filter(&(&1.status == "reconnecting"))
      |> Enum.reject(fn departure ->
        Enum.any?(online, &(&1.identity_key == departure.identity_key))
      end)
      |> Enum.map(fn departure ->
        %{
          id: "reconnecting:#{departure.identity_key}",
          peer_id: "reconnecting:#{departure.identity_key}",
          session_id: departure.id,
          identity_key: departure.identity_key,
          nickname: departure.nickname,
          registered?: String.starts_with?(departure.identity_key, "user:"),
          rank: nil,
          theme_id: Themes.default_theme_id(),
          appearance: Appearance.default(),
          reconnecting?: true
        }
      end)

    online
    |> Kernel.++(reconnecting)
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

  def resolve_peer(room_id, nickname) when is_binary(nickname) do
    peers =
      room_id
      |> list_online()
      |> Enum.reject(&Map.get(&1, :reconnecting?, false))
      |> Enum.filter(&(&1.nickname == nickname))

    case peers do
      [%{peer_id: peer_id}] -> {:ok, peer_id}
      [] -> {:error, :recipient_offline}
      _duplicates -> {:error, :ambiguous_recipient}
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
      karma: Keyword.get(opts, :karma, 0),
      session_id: Keyword.get(opts, :session_id),
      identity_key: Keyword.get(opts, :identity_key),
      connection_epoch: Keyword.get(opts, :connection_epoch),
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
      karma: Map.get(attrs, :karma, 0),
      session_id: Map.get(attrs, :session_id),
      identity_key: Map.get(attrs, :identity_key),
      connection_epoch: Map.get(attrs, :connection_epoch),
      theme_id: theme_id,
      appearance: appearance
    }
  end

  defp appearance_from(attrs) do
    attrs
    |> Map.get(:appearance, Appearance.default())
    |> Appearance.normalize()
  end
end
