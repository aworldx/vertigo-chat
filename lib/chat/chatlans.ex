# Назначение файла: контекст чатлан, их Presence-состояния, онлайн-списка и гостевых настроек.
defmodule Chat.Chatlans do
  @moduledoc """
  Tracks chat participants and their public realtime appearance.
  """

  alias Chat.Appearance
  alias Chat.Messages
  alias Chat.Presence
  alias Chat.Themes

  def guest_presence_key do
    "presence-" <> (:crypto.strong_rand_bytes(8) |> Base.url_encode64(padding: false))
  end

  def guest_nickname do
    "guest-" <> (:crypto.strong_rand_bytes(3) |> Base.url_encode64(padding: false))
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
      for meta <- metas do
        appearance = appearance_from(meta)
        theme_id = Map.get(meta, :theme_id, Themes.default_theme_id())

        %{
          id: "#{id}:#{meta.phx_ref}",
          peer_id: id,
          nickname: meta.nickname,
          theme_id: theme_id,
          appearance: appearance
        }
      end
    end)
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
      |> Enum.filter(&(&1.nickname == nickname))

    case peers do
      [%{peer_id: peer_id}] -> {:ok, peer_id}
      [] -> {:error, :recipient_offline}
      _duplicates -> {:error, :ambiguous_recipient}
    end
  end

  def appearance_attrs(nickname, theme_id, appearance) do
    theme_id = Themes.normalize_theme_id(theme_id)
    appearance = Appearance.normalize(appearance)

    %{
      nickname: normalize_nickname(nickname, nil),
      theme_id: theme_id,
      appearance: appearance
    }
  end

  defp presence_meta(attrs) do
    theme_id = Map.get(attrs, :theme_id, Themes.default_theme_id()) |> Themes.normalize_theme_id()
    appearance = appearance_from(attrs)

    %{
      nickname: attrs.nickname,
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
