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
  alias Chat.Sessions.ConnectionRegistry
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
      :connection_epoch
    ]
  end

  @doc "Starts a fresh chat session after validating entrance credentials."
  def enter(room_id, nickname, password, opts \\ [])

  def enter(room_id, nickname, password, opts) when is_binary(room_id) and is_binary(nickname) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    presence_key = Keyword.get(opts, :presence_key)

    with nickname when is_binary(nickname) <- nickname,
         true <- is_binary(presence_key),
         {:ok, user} <- Accounts.authorize_entrance(nickname, password),
         {identity_key, guest_identity_id} <- identity_for(user),
         :ok <- Chatlans.ensure_nickname_available(room_id, nickname, nil, nil, identity_key),
         session_id = Ecto.UUID.generate(),
         {:ok, visit} <- start_visit(user, nickname, session_id, identity_key),
         :ok <- ConnectionRegistry.start_session(session_id, identity_key) do
      {:ok,
       %Session{
         room_id: room_id,
         nickname: nickname,
         user: user,
         identity_key: identity_key,
         guest_identity_id: guest_identity_id,
         presence_key: presence_key,
         session_id: session_id,
         visit: visit
       }}
    else
      false -> {:error, :invalid_session}
      nil -> {:error, :invalid_nickname}
      {:error, _reason} = error -> error
    end
  end

  def enter(_room_id, _nickname, _password, _opts), do: {:error, :invalid_nickname}

  @doc "Restores a previously authenticated chat session on a new connection."
  def restore(room_id, attrs) when is_binary(room_id) and is_map(attrs) do
    nickname = Chatlans.normalize_nickname(Map.get(attrs, :nickname), nil)
    presence_key = Map.get(attrs, :presence_key)
    session_id = Map.get(attrs, :session_id)
    identity_key = Map.get(attrs, :identity_key)
    user = Map.get(attrs, :user)

    with nickname when is_binary(nickname) <- nickname,
         true <- is_binary(presence_key) and is_binary(session_id) and is_binary(identity_key),
         :ok <- ConnectionRegistry.restore_session(session_id, identity_key),
         {:ok, restored} <-
           Chatlans.restore_session(
             room_id,
             nickname,
             presence_key,
             Map.get(attrs, :stored_presence_key),
             guest?: is_nil(user),
             session_id: session_id,
             identity_key: identity_key
           ),
         {:ok, visit} <- start_visit(user, restored.nickname, session_id, identity_key) do
      {:ok,
       %Session{
         room_id: room_id,
         nickname: restored.nickname,
         user: user,
         identity_key: identity_key,
         presence_key: restored.presence_key,
         session_id: session_id,
         visit: visit,
         guest_identity_id: Map.get(attrs, :guest_identity_id)
       }}
    else
      false -> {:error, :invalid_session}
      nil -> {:error, :invalid_nickname}
      {:error, _reason} = error -> error
    end
  end

  @doc "Attaches a live transport to a session and cancels any reconnect grace."
  def connect(%Session{} = session, pid, appearance) when is_pid(pid) and is_map(appearance) do
    with {:ok, epoch} <- ConnectionRegistry.connect(session.session_id, session.identity_key),
         session = %{session | connection_epoch: epoch},
         {:ok, ref} <-
           Chatlans.track(
             pid,
             session.room_id,
             session.presence_key,
             Map.put(appearance, :connection_epoch, epoch)
           ) do
      :ok = Chatlans.cancel_scheduled_departure(session.room_id, session.identity_key)
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

    case end_current_connection(session) do
      :ok -> Chatlans.announce_departure(session.room_id, session.nickname, session.identity_key)
      :stale -> :ok
    end
  end

  @doc "Handles an unintentional transport loss and starts reconnect grace."
  def connection_lost(%Session{} = session, pid) when is_pid(pid) do
    Chatlans.untrack(pid, session.room_id, session.presence_key)

    case ConnectionRegistry.connection_lost(
           session.session_id,
           session.identity_key,
           session.connection_epoch
         ) do
      :ok ->
        # A session may have another active transport (for example, a refreshed tab).
        # A late termination from the old transport must not turn that session into
        # a reconnecting participant.
        unless Chatlans.identity_online?(session.room_id, session.identity_key) do
          Chatlans.schedule_disconnect(session.room_id, session.nickname, session.identity_key)
        end

        :ok

      :stale ->
        :ok
    end
  end

  def touch(%Session{} = session) do
    if current_connection?(session),
      do: Visits.touch_active_visit(session.identity_key),
      else: :ok
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

  defp start_visit(%User{} = user, _nickname, session_id, _identity_key),
    do: Visits.start_visit(user, DateTime.utc_now(), session_id: session_id)

  defp start_visit(nil, nickname, session_id, identity_key),
    do:
      Visits.start_visit(nickname, DateTime.utc_now(),
        session_id: session_id,
        identity_key: identity_key
      )

  defp current_connection?(%Session{connection_epoch: epoch} = session) when is_integer(epoch) do
    ConnectionRegistry.current?(session.session_id, session.identity_key, epoch)
  end

  defp current_connection?(%Session{}), do: false

  defp end_current_connection(%Session{connection_epoch: epoch} = session)
       when is_integer(epoch) do
    ConnectionRegistry.leave(session.session_id, session.identity_key, epoch)
  end

  defp end_current_connection(%Session{}), do: :stale
end
