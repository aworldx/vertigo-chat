# Test-only process on an independent BEAM VM. It owns real transports and a
# regular connection pool, so cross-node tests cannot share a sandbox transaction.
defmodule Chat.SessionNode do
  use GenServer

  import Ecto.Query
  alias Chat.{Chatlans, Repo, Sessions}
  alias Chat.Sessions.{ChatSession, Store}

  def boot(config, migrate?) do
    Application.load(:chat)
    Application.put_all_env(config)
    Logger.configure(level: :error)

    if migrate? do
      {:ok, _} = Application.ensure_all_started(:ecto_sql)
      {:ok, _} = Application.ensure_all_started(:postgrex)

      {:ok, _, _} =
        Ecto.Migrator.with_repo(Repo, fn repo ->
          Ecto.Migrator.run(repo, "priv/repo/migrations", :up, all: true, log: false)
        end)
    end

    {:ok, _} = Application.ensure_all_started(:chat)
    {:ok, _} = Supervisor.start_child(Chat.Supervisor, __MODULE__)
    :ok
  end

  def start_link(_opts), do: GenServer.start_link(__MODULE__, nil, name: __MODULE__)
  def init(state), do: {:ok, state}

  def handle_call(command, _from, state), do: {:reply, execute(command), state}

  defp execute({:enter, room, nickname, password}) do
    with {:ok, session} <-
           Sessions.enter(room, nickname, password, presence_key: Chatlans.guest_presence_key()),
         {:ok, _, connected} <- Sessions.connect(session, self(), appearance(session)) do
      {:ok, connected}
    end
  end

  defp execute({:restore, session}) do
    with {:ok, restored} <-
           Sessions.restore(session.room_id, %{
             nickname: session.nickname,
             identity_key: session.identity_key,
             user: session.user,
             session_id: session.session_id,
             resume_secret: session.resume_secret,
             presence_key: Chatlans.guest_presence_key()
           }),
         {:ok, _, connected} <- Sessions.connect(restored, self(), appearance(restored)) do
      {:ok, connected}
    end
  end

  defp execute({:restore_at, session, now}),
    do: Store.restore(session.session_id, session.identity_key, session.resume_secret, now)

  defp execute({:disconnect, session}), do: Sessions.connection_lost(session, self())
  defp execute({:leave, session}), do: Sessions.leave(session, self())
  defp execute({:reap, now}), do: Sessions.reap(now)

  defp execute({:touch, session, now}),
    do: Store.touch(session.session_id, session.identity_key, session.connection_epoch, now)

  defp execute({:reconnect_at, session, now}),
    do: Store.reconnect(session.session_id, session.identity_key, session.connection_epoch, now)

  defp execute({:register, nickname}),
    do: Chat.Accounts.register_user(%{nickname: nickname, password: "integration123"})

  defp execute({:snapshot, room}) do
    sessions = Repo.all(from s in ChatSession, where: s.room_id == ^room, order_by: s.inserted_at)
    ids = Enum.map(sessions, & &1.visit_id)

    %{
      sessions: sessions,
      visits: Repo.all(from v in Chat.Visits.Visit, where: v.id in ^ids),
      messages: Chat.Messages.History.list_recent(room),
      online: Chatlans.list_online(room)
    }
  end

  defp appearance(session),
    do: %{
      nickname: session.nickname,
      identity_key: session.identity_key,
      session_id: session.session_id
    }
end
