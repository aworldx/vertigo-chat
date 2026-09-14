# Назначение файла: контекст хит-парада — загрузка треков и голоса участников.
defmodule Chat.MusicChart do
  @moduledoc "Общий хит-парад музыки Vertigo."

  import Ecto.Query

  alias Chat.Accounts.User
  alias Chat.MusicChart.{Comment, Like, Track}
  alias Chat.Repo
  alias Chat.Uploads

  @topic "music_chart"
  @max_tracks_per_user 5
  @max_audio_bytes 20_000_000
  @max_title_length 120
  @max_comment_length 280

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)

  def list_tracks(viewer \\ nil) do
    liked_track_ids = liked_track_ids(viewer)

    Track
    |> join(:left, [track], like in Like, on: like.track_id == track.id)
    |> group_by([track], track.id)
    |> order_by([track, like], desc: count(like.id), desc: track.inserted_at, desc: track.id)
    |> select_merge([_track, like], %{likes_count: count(like.id)})
    |> Repo.all()
    |> Repo.preload([:user, comments: :user])
    |> Enum.map(&%{&1 | liked?: MapSet.member?(liked_track_ids, &1.id)})
  end

  def get_track(id) when is_integer(id) and id > 0, do: Repo.get(Track, id)
  def get_track(_id), do: nil

  def add_track(%User{} = user, title, audio, content_type)
      when is_binary(title) and is_binary(audio) and is_binary(content_type) do
    title = String.trim(title)

    cond do
      title == "" or String.length(title) > @max_title_length ->
        {:error, :invalid_title}

      byte_size(audio) > @max_audio_bytes or not Uploads.valid_audio?(audio, content_type) ->
        {:error, :invalid_audio}

      true ->
        insert_track(user, title, audio, content_type)
    end
  end

  def add_track(_user, _title, _audio, _content_type), do: {:error, :invalid_audio}

  def toggle_like(%User{} = user, track_id) when is_integer(track_id) and track_id > 0 do
    case Repo.get(Track, track_id) do
      nil -> {:error, :not_found}
      %{user_id: user_id} when user_id == user.id -> {:error, :own_track}
      _track -> toggle_user_like(user, track_id)
    end
  end

  def toggle_like(_user, _track_id), do: {:error, :not_found}

  def add_comment(%User{} = user, track_id, body)
      when is_integer(track_id) and track_id > 0 and is_binary(body) do
    with %Track{} <- get_track(track_id),
         {:ok, comment} <-
           %Comment{}
           |> Comment.changeset(track_id, user.id, body)
           |> Repo.insert() do
      broadcast_change()
      {:ok, Repo.preload(comment, :user)}
    else
      nil -> {:error, :not_found}
      {:error, changeset} -> {:error, changeset}
    end
  end

  def add_comment(_user, _track_id, _body), do: {:error, :not_found}

  def max_tracks_per_user, do: @max_tracks_per_user
  def max_audio_bytes, do: @max_audio_bytes
  def max_title_length, do: @max_title_length
  def max_comment_length, do: @max_comment_length

  defp insert_track(user, title, audio, content_type) do
    Repo.transaction(
      fn ->
        lock_user!(user.id)

        if Repo.aggregate(from(track in Track, where: track.user_id == ^user.id), :count) >=
             @max_tracks_per_user do
          Repo.rollback(:track_limit_reached)
        end

        case %Track{}
             |> Track.changeset(user, title, audio, content_type)
             |> store_media() do
          {:ok, track} -> track
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end,
      timeout: 180_000
    )
    |> case do
      {:ok, track} ->
        broadcast_change()
        {:ok, Repo.preload(track, :user)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp toggle_user_like(user, track_id) do
    result =
      case Repo.get_by(Like, track_id: track_id, user_id: user.id) do
        nil ->
          %Like{}
          |> Like.changeset(track_id, user.id)
          |> Repo.insert(on_conflict: :nothing, conflict_target: [:track_id, :user_id])
          |> case do
            {:ok, _like} -> :liked
            {:error, _changeset} -> :error
          end

        like ->
          case Repo.delete(like) do
            {:ok, _like} -> :unliked
            {:error, _changeset} -> :error
          end
      end

    case result do
      result when result in [:liked, :unliked] ->
        broadcast_change()
        {:ok, result}

      :error ->
        {:error, :like_failed}
    end
  end

  defp liked_track_ids(%User{id: user_id}) do
    Like
    |> where([like], like.user_id == ^user_id)
    |> select([like], like.track_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp liked_track_ids(_viewer), do: MapSet.new()

  defp store_media(changeset) do
    with {:ok, stored} <- Chat.Media.persist(changeset), do: Repo.insert(stored)
  end

  def audio_resource(id), do: Chat.Media.resource(get_track(id), :audio)

  defp lock_user!(user_id),
    do: Repo.one!(from(user in User, where: user.id == ^user_id, lock: "FOR UPDATE"))

  defp broadcast_change, do: Phoenix.PubSub.broadcast(Chat.PubSub, @topic, :music_chart_changed)
end
