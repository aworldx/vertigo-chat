# Назначение файла: транзакционные переходы устойчивого состояния чат-сессии.
defmodule Chat.Sessions.Store do
  import Ecto.Query

  alias Chat.Repo
  alias Chat.Sessions.ChatSession

  @grace_seconds 60
  @hidden_grace_seconds 30 * 60
  @heartbeat_timeout_seconds 180

  def hidden_grace_seconds, do: @hidden_grace_seconds

  def create(attrs) do
    session_id = Map.fetch!(attrs, :id)
    Repo.insert(ChatSession.create_changeset(%ChatSession{id: session_id}, attrs))
  end

  def end_active_for_identity(room_id, identity_key, now \\ DateTime.utc_now()) do
    now = truncate(now)

    from(session in ChatSession,
      where:
        session.room_id == ^room_id and session.identity_key == ^identity_key and
          session.status in ["active", "reconnecting"]
    )
    |> Repo.update_all(
      set: [status: "ended", ended_at: now, reconnect_deadline_at: nil, updated_at: now],
      inc: [generation: 1]
    )
  end

  def restore(session_id, identity_key, resume_secret, now \\ DateTime.utc_now(), opts \\ []) do
    now = truncate(now)

    Repo.transaction(fn ->
      with {:ok, id} <- Ecto.UUID.cast(session_id),
           %ChatSession{} = session <- Repo.get(ChatSession, id),
           true <- session.identity_key == identity_key,
           true <- valid_secret?(session, resume_secret),
           true <- session.room_id == Keyword.get(opts, :room_id, session.room_id),
           true <- session.nickname == Keyword.get(opts, :nickname, session.nickname),
           false <- session.status == "ended",
           false <- expired?(session, now) do
        result =
          ChatSession
          |> where(
            [current],
            current.id == ^session.id and current.generation == ^session.generation and
              current.status in ["active", "reconnecting"] and
              (is_nil(current.reconnect_deadline_at) or current.reconnect_deadline_at > ^now)
          )
          |> Repo.update_all(
            set: [
              status: "active",
              last_seen_at: now,
              reconnect_deadline_at: nil,
              updated_at: now
            ],
            inc: [generation: 1]
          )

        case result do
          {1, _} -> Repo.get!(ChatSession, session.id)
          {0, _} -> Repo.rollback(:session_ended)
        end
      else
        nil -> Repo.rollback(:not_found)
        false -> Repo.rollback(:invalid_session)
        true -> Repo.rollback(:session_ended)
        _ -> Repo.rollback(:invalid_session)
      end
    end)
  end

  def reconnect(session_id, identity_key, generation, now \\ DateTime.utc_now()) do
    now = truncate(now)

    query =
      from session in ChatSession,
        where:
          session.id == ^session_id and session.identity_key == ^identity_key and
            session.generation == ^generation and session.status == "active"

    case Repo.one(query) do
      nil ->
        :stale

      session ->
        deadline = DateTime.add(now, grace_seconds(session), :second)

        case Repo.update_all(query,
               set: [status: "reconnecting", reconnect_deadline_at: deadline, updated_at: now]
             ) do
          {1, _} -> {:ok, deadline}
          {0, _} -> :stale
        end
    end
  end

  def activate(session_id, identity_key, generation, now \\ DateTime.utc_now()) do
    now = truncate(now)
    cutoff = DateTime.add(now, -(@heartbeat_timeout_seconds + @grace_seconds), :second)

    hidden_cutoff =
      DateTime.add(now, -(@heartbeat_timeout_seconds + @hidden_grace_seconds), :second)

    from(session in ChatSession,
      where:
        session.id == ^session_id and session.identity_key == ^identity_key and
          session.generation == ^generation and session.status in ["active", "reconnecting"] and
          ((session.status == "active" and
              ((session.last_visibility == "hidden" and session.last_seen_at > ^hidden_cutoff) or
                 (session.last_visibility != "hidden" and session.last_seen_at > ^cutoff))) or
             (session.status == "reconnecting" and session.reconnect_deadline_at > ^now)),
      select: session.generation
    )
    |> Repo.update_all(
      set: [
        status: "active",
        last_seen_at: now,
        reconnect_deadline_at: nil,
        updated_at: now
      ],
      inc: [generation: 1]
    )
    |> case do
      {1, [epoch]} -> {:ok, epoch}
      {0, _} -> {:error, :stale_connection}
    end
  end

  def end_session(session_id, identity_key, generation, now \\ DateTime.utc_now()) do
    now = truncate(now)

    query =
      from session in ChatSession,
        where:
          session.id == ^session_id and session.identity_key == ^identity_key and
            session.generation == ^generation and session.status in ["active", "reconnecting"]

    case Repo.update_all(query,
           set: [status: "ended", ended_at: now, reconnect_deadline_at: nil, updated_at: now],
           inc: [generation: 1]
         ) do
      {1, _} -> :ended
      {0, _} -> :stale
    end
  end

  def expired(now \\ DateTime.utc_now()) do
    now = truncate(now)

    from(session in ChatSession,
      where: session.status == "reconnecting" and session.reconnect_deadline_at <= ^now
    )
    |> Repo.all()
  end

  def expire(session, now \\ DateTime.utc_now()) do
    now = truncate(now)

    query =
      from current in ChatSession,
        where:
          current.id == ^session.id and current.generation == ^session.generation and
            current.status == "reconnecting" and
            current.reconnect_deadline_at <= ^now

    case Repo.update_all(query,
           set: [status: "ended", ended_at: now, reconnect_deadline_at: nil, updated_at: now],
           inc: [generation: 1]
         ) do
      {1, _} -> :ended
      {0, _} -> :stale
    end
  end

  defp valid_secret?(%ChatSession{resume_secret_hash: hash}, secret)
       when is_binary(secret) and byte_size(secret) >= 32 do
    Plug.Crypto.secure_compare(hash, hash_secret(secret))
  end

  defp valid_secret?(_session, _secret), do: false

  def hash_secret(secret) when is_binary(secret),
    do: :crypto.hash(:sha256, secret) |> Base.encode16(case: :lower)

  def current?(id, identity, generation) do
    now = DateTime.utc_now() |> truncate()
    cutoff = DateTime.add(now, -(@heartbeat_timeout_seconds + @grace_seconds), :second)

    hidden_cutoff =
      DateTime.add(now, -(@heartbeat_timeout_seconds + @hidden_grace_seconds), :second)

    Repo.exists?(
      from session in ChatSession,
        where:
          session.id == ^id and session.identity_key == ^identity and
            session.generation == ^generation and session.status == "active" and
            ((session.last_visibility == "hidden" and session.last_seen_at > ^hidden_cutoff) or
               (session.last_visibility != "hidden" and session.last_seen_at > ^cutoff))
    )
  end

  def register_identity(session, user, secret) do
    identity = Chat.Visits.user_identity_key(user)
    now = DateTime.utc_now() |> truncate()

    query =
      from current in ChatSession,
        where:
          current.id == ^session.session_id and current.identity_key == ^session.identity_key and
            current.generation == ^session.connection_epoch and current.status == "active",
        select: current

    case Repo.update_all(query,
           set: [
             identity_key: identity,
             resume_secret_hash: hash_secret(secret),
             last_seen_at: now,
             updated_at: now
           ],
           inc: [generation: 1]
         ) do
      {1, [stored]} -> {:ok, stored}
      {0, _} -> {:error, :stale_connection}
    end
  end

  def touch(id, identity, generation),
    do: touch(id, identity, generation, "unknown", DateTime.utc_now())

  def touch(id, identity, generation, %DateTime{} = now),
    do: touch(id, identity, generation, "unknown", now)

  def touch(id, identity, generation, visibility),
    do: touch(id, identity, generation, visibility, DateTime.utc_now())

  def touch(id, identity, generation, visibility, now) do
    now = truncate(now)
    cutoff = DateTime.add(now, -(@heartbeat_timeout_seconds + @grace_seconds), :second)

    hidden_cutoff =
      DateTime.add(now, -(@heartbeat_timeout_seconds + @hidden_grace_seconds), :second)

    visibility = normalize_visibility(visibility)

    query =
      from session in ChatSession,
        where:
          session.id == ^id and session.identity_key == ^identity and
            session.generation == ^generation and session.status == "active" and
            ((session.last_visibility == "hidden" and session.last_seen_at > ^hidden_cutoff) or
               (session.last_visibility != "hidden" and session.last_seen_at > ^cutoff))

    case Repo.update_all(query,
           set: [last_seen_at: now, last_visibility: visibility, updated_at: now]
         ) do
      {1, _} -> :ok
      {0, _} -> :stale
    end
  end

  def mark_stale(now \\ DateTime.utc_now()) do
    now = truncate(now)
    cutoff = DateTime.add(now, -@heartbeat_timeout_seconds, :second)

    query =
      from session in ChatSession,
        where: session.status == "active" and session.last_seen_at <= ^cutoff,
        select: session

    query
    |> Repo.all()
    |> Enum.flat_map(fn session ->
      deadline =
        DateTime.add(
          session.last_seen_at,
          @heartbeat_timeout_seconds + grace_seconds(session),
          :second
        )

      update =
        from current in ChatSession,
          where:
            current.id == ^session.id and current.generation == ^session.generation and
              current.status == "active" and current.last_seen_at <= ^cutoff

      case Repo.update_all(update,
             set: [status: "reconnecting", reconnect_deadline_at: deadline, updated_at: now]
           ) do
        {1, _} -> [session]
        {0, _} -> []
      end
    end)
  end

  def live(room_id) do
    Repo.all(
      from session in ChatSession,
        where: session.room_id == ^room_id and session.status in ["active", "reconnecting"]
    )
  end

  def pending(room_id), do: Enum.filter(live(room_id), &(&1.status == "reconnecting"))

  defp expired?(%ChatSession{reconnect_deadline_at: nil, last_seen_at: seen} = session, now),
    do: DateTime.diff(now, seen) >= @heartbeat_timeout_seconds + grace_seconds(session)

  defp expired?(%ChatSession{reconnect_deadline_at: deadline}, now),
    do: DateTime.compare(deadline, now) != :gt

  defp truncate(datetime), do: DateTime.truncate(datetime, :second)

  defp grace_seconds(%ChatSession{last_visibility: "hidden"}), do: @hidden_grace_seconds
  defp grace_seconds(_session), do: @grace_seconds

  defp normalize_visibility(visibility) when visibility in ["visible", "hidden"], do: visibility
  defp normalize_visibility(_visibility), do: "unknown"
end
