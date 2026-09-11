# Назначение файла: контекст жизненного цикла чат-сессий — вход, connection и выход.
defmodule Chat.Sessions do
  @moduledoc """
  Owns chat-session transitions independently from the LiveView transport.

  A `%Session{}` represents one identity in one room. Browser tokens are
  deliberately verified by the web adapter before restoration; this context
  owns the domain transitions and their effects on visits and Presence.
  """

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Chatlans
  alias Chat.Messages
  alias Chat.Repo
  alias Chat.Sessions.Store
  alias Chat.Visits

  defmodule Session do
    @enforce_keys [
      :room_id,
      :nickname,
      :identity_key,
      :presence_key,
      :session_id,
      :visit
    ]

    defstruct [
      :room_id,
      :nickname,
      :identity_key,
      :presence_key,
      :session_id,
      :visit,
      :user,
      :guest_identity_id,
      :resume_secret,
      :connection_epoch
    ]
  end

  @doc "Starts a fresh chat session after validating entrance credentials."
  def enter(room_id, nickname, password, opts \\ [])

  def enter(room_id, nickname, password, opts) when is_binary(room_id) and is_binary(nickname) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    presence_key = Keyword.get(opts, :presence_key)

    Repo.transaction(fn ->
      with nickname when is_binary(nickname) <- nickname,
           true <- is_binary(presence_key),
           {:ok, user} <- Accounts.authorize_entrance(nickname, password),
           {identity_key, guest_identity_id} <- identity_for(user),
           :ok <- ensure_nickname_available(room_id, nickname),
           session_id = Ecto.UUID.generate(),
           {:ok, visit} <- start_visit(user, nickname, session_id, identity_key),
           resume_secret = new_resume_secret(),
           {:ok, _stored_session} <-
             Store.create(%{
               id: session_id,
               room_id: room_id,
               identity_key: identity_key,
               nickname: nickname,
               resume_secret_hash: Store.hash_secret(resume_secret),
               status: "active",
               last_seen_at: DateTime.utc_now(),
               generation: 0,
               visit_id: visit.id
             }) do
        %Session{
          room_id: room_id,
          nickname: nickname,
          user: user,
          identity_key: identity_key,
          guest_identity_id: guest_identity_id,
          presence_key: presence_key,
          session_id: session_id,
          resume_secret: resume_secret,
          connection_epoch: 0,
          visit: visit
        }
      else
        false -> Repo.rollback(:invalid_session)
        nil -> Repo.rollback(:invalid_nickname)
        {:error, %Ecto.Changeset{}} -> Repo.rollback(:nickname_online)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def enter(_room_id, _nickname, _password, _opts), do: {:error, :invalid_nickname}

  @doc "Registers a nickname and starts its first session as one transaction."
  def register_and_enter(room_id, attrs, subject, opts \\ []) do
    Repo.transaction(fn ->
      with {:ok, user} <- Accounts.register_user(attrs, subject),
           {:ok, session} <- enter(room_id, user.nickname, attrs["password"], opts) do
        session
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Registers a guest without changing the session or its audit visit."
  def register_user(%Session{user: nil} = session, attrs, subject) do
    attrs = attrs |> Map.delete(:nickname) |> Map.put("nickname", session.nickname)

    Repo.transaction(fn ->
      with true <- current_connection?(session),
           {:ok, user} <- Accounts.register_user(attrs, subject),
           secret = new_resume_secret(),
           {:ok, stored} <- Store.register_identity(session, user, secret),
           {:ok, visit} <- Visits.register_visit(session.visit, user) do
        %{
          session
          | user: user,
            identity_key: stored.identity_key,
            visit: visit,
            connection_epoch: stored.generation,
            resume_secret: secret,
            guest_identity_id: nil
        }
      else
        false -> Repo.rollback(:stale_connection)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def register_user(%Session{}, _attrs, _subject), do: {:error, :already_registered}

  @doc "Restores a previously authenticated chat session on a new connection."
  def restore(room_id, attrs) when is_binary(room_id) and is_map(attrs) do
    nickname = Chatlans.normalize_nickname(Map.get(attrs, :nickname), nil)
    presence_key = Map.get(attrs, :presence_key)
    session_id = Map.get(attrs, :session_id)
    identity_key = Map.get(attrs, :identity_key)
    user = Map.get(attrs, :user)
    resume_secret = Map.get(attrs, :resume_secret)

    with nickname when is_binary(nickname) <- nickname,
         true <- is_binary(presence_key) and is_binary(session_id) and is_binary(identity_key),
         false <- is_nil(user) and Accounts.registered_nickname?(nickname),
         {:ok, stored} <-
           Store.restore(session_id, identity_key, resume_secret, DateTime.utc_now(),
             room_id: room_id,
             nickname: nickname
           ),
         visit = Repo.get!(Chat.Visits.Visit, stored.visit_id) do
      {:ok,
       %Session{
         room_id: room_id,
         nickname: stored.nickname,
         user: user,
         identity_key: identity_key,
         presence_key: presence_key,
         session_id: session_id,
         visit: visit,
         guest_identity_id: Map.get(attrs, :guest_identity_id),
         resume_secret: resume_secret,
         connection_epoch: stored.generation
       }}
    else
      true -> {:error, :registered_nickname}
      false -> {:error, :invalid_session}
      nil -> {:error, :invalid_nickname}
      {:error, _reason} = error -> error
    end
  end

  @doc "Attaches a live transport to a session and cancels any reconnect grace."
  def connect(%Session{} = session, pid, appearance) when is_pid(pid) and is_map(appearance) do
    with {:ok, epoch} <-
           Store.activate(session.session_id, session.identity_key, session.connection_epoch),
         session = %{session | connection_epoch: epoch},
         {:ok, ref} <-
           Chatlans.track(
             pid,
             session.room_id,
             session.presence_key,
             Map.put(appearance, :connection_epoch, epoch)
           ) do
      :ok = notify_change(session.room_id)
      {:ok, ref, session}
    else
      {:error, _reason} = error -> error
      result -> result
    end
  end

  @doc "Updates the public Presence projection for the active connection."
  def update_connection(%Session{} = session, pid, appearance)
      when is_pid(pid) and is_map(appearance) do
    if current_connection?(session) do
      Chatlans.update(
        pid,
        session.room_id,
        session.presence_key,
        Map.put(appearance, :connection_epoch, session.connection_epoch)
      )
    else
      {:error, :stale_connection}
    end
  end

  @doc "Replaces a Presence projection without treating it as a disconnect."
  def retrack(%Session{} = session, pid, appearance) when is_pid(pid) and is_map(appearance) do
    if current_connection?(session) do
      Chatlans.untrack(pid, session.room_id, session.presence_key)

      Chatlans.track(
        pid,
        session.room_id,
        session.presence_key,
        Map.put(appearance, :connection_epoch, session.connection_epoch)
      )
    else
      {:error, :stale_connection}
    end
  end

  @doc "Ends a session intentionally. This transition wins over reconnect grace."
  def leave(%Session{} = session, pid) when is_pid(pid) do
    Chatlans.untrack(pid, session.room_id, session.presence_key)

    finalize(session, fn ->
      Store.end_session(session.session_id, session.identity_key, session.connection_epoch)
    end)
  end

  @doc "Handles an unintentional transport loss and starts reconnect grace."
  def connection_lost(%Session{} = session, pid) when is_pid(pid) do
    Chatlans.untrack(pid, session.room_id, session.presence_key)

    case Store.reconnect(session.session_id, session.identity_key, session.connection_epoch) do
      {:ok, _deadline} -> notify_change(session.room_id)
      :stale -> :ok
    end
  end

  def touch(%Session{} = session) do
    if Store.touch(session.session_id, session.identity_key, session.connection_epoch) == :ok,
      do: Visits.touch_active_visit(session.identity_key),
      else: :ok
  end

  def reap(now \\ DateTime.utc_now()) do
    Store.mark_stale(now)
    |> Enum.each(&notify_change(&1.room_id))

    Enum.each(Store.expired(now), fn session ->
      finalize(session, fn -> Store.expire(session, now) end, now)
    end)

    :ok
  end

  defp finalize(session, transition, now \\ DateTime.utc_now()) do
    {:ok, message} =
      Repo.transaction(fn ->
        case transition.() do
          :ended ->
            visit_id =
              case session do
                %Session{visit: visit} -> visit.id
                %{visit_id: id} -> id
              end

            if visit_id do
              {:ok, _visit} = Visits.finish_visit(Repo.get!(Chat.Visits.Visit, visit_id), now)
            end

            {:ok, message} = Messages.persist_departure(session.nickname, session.room_id)
            message

          :stale ->
            nil
        end
      end)

    if message do
      Messages.broadcast_persisted(session.room_id, message)
      notify_change(session.room_id)
    end

    :ok
  end

  defp notify_change(room_id) do
    Phoenix.PubSub.broadcast(
      Chat.PubSub,
      Messages.room_topic(room_id),
      {:presence_grace_changed, room_id}
    )
  end

  @doc "Publishes the one-time room announcement for a newly entered session."
  def announce_join(%Session{} = session) do
    if current_connection?(session) do
      Messages.announce_presence(session.nickname, session.room_id, :joined)
    else
      {:error, :stale_connection}
    end
  end

  defp identity_for(%User{} = user), do: {Visits.user_identity_key(user), nil}

  defp identity_for(nil) do
    identity_id = Ecto.UUID.generate()
    {Visits.guest_identity_key(identity_id), identity_id}
  end

  defp new_resume_secret, do: :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

  defp ensure_nickname_available(room_id, nickname) do
    if nickname == Chat.Bot.name() or Enum.any?(Store.live(room_id), &(&1.nickname == nickname)),
      do: {:error, :nickname_online},
      else: :ok
  end

  defp start_visit(%User{} = user, _nickname, session_id, _identity_key),
    do: Visits.start_visit(user, DateTime.utc_now(), session_id: session_id)

  defp start_visit(nil, nickname, session_id, identity_key),
    do:
      Visits.start_visit(nickname, DateTime.utc_now(),
        session_id: session_id,
        identity_key: identity_key
      )

  def current_connection?(%Session{connection_epoch: epoch} = session) when is_integer(epoch) do
    Store.current?(session.session_id, session.identity_key, epoch)
  end

  def current_connection?(%Session{}), do: false
end
