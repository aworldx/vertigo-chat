# Назначение файла: хранит актуальный epoch transport-подключения для чат-сессии.
defmodule Chat.Sessions.ConnectionRegistry do
  @moduledoc false

  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, %{}, name: Keyword.get(opts, :name, __MODULE__))
  end

  @doc "Registers a newly created session before its first connection."
  def start_session(session_id, identity_key)
      when is_binary(session_id) and is_binary(identity_key) do
    GenServer.call(__MODULE__, {:start_session, session_id, identity_key})
  end

  @doc "Verifies that a restored browser session has not been explicitly ended."
  def restore_session(session_id, identity_key)
      when is_binary(session_id) and is_binary(identity_key) do
    GenServer.call(__MODULE__, {:restore_session, session_id, identity_key})
  end

  @doc "Issues the next monotonic epoch for a transport connecting to a session."
  def connect(session_id, identity_key) when is_binary(session_id) and is_binary(identity_key) do
    GenServer.call(__MODULE__, {:connect, session_id, identity_key})
  end

  @doc "Returns whether this transport is the current connection for its session."
  def current?(session_id, identity_key, epoch)
      when is_binary(session_id) and is_binary(identity_key) and is_integer(epoch) do
    GenServer.call(__MODULE__, {:current?, session_id, identity_key, epoch})
  end

  @doc "Moves the current transport into reconnecting state."
  def connection_lost(session_id, identity_key, epoch)
      when is_binary(session_id) and is_binary(identity_key) and is_integer(epoch) do
    GenServer.call(__MODULE__, {:connection_lost, session_id, identity_key, epoch})
  end

  @doc "Ends the session only when requested by its current transport."
  def leave(session_id, identity_key, epoch)
      when is_binary(session_id) and is_binary(identity_key) and is_integer(epoch) do
    GenServer.call(__MODULE__, {:leave, session_id, identity_key, epoch})
  end

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:start_session, session_id, identity_key}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        {:reply, :ok, Map.put(state, session_id, session(identity_key))}

      %{identity_key: ^identity_key, state: :ended} ->
        {:reply, {:error, :session_ended}, state}

      %{identity_key: ^identity_key} ->
        {:reply, :ok, state}

      _other ->
        {:reply, {:error, :session_identity_mismatch}, state}
    end
  end

  def handle_call({:restore_session, session_id, identity_key}, _from, state) do
    case Map.get(state, session_id) do
      nil ->
        # Registry state is intentionally ephemeral. A server restart may restore
        # a still-valid browser session, while an explicit leave is fenced during
        # the lifetime of this node.
        {:reply, :ok, Map.put(state, session_id, session(identity_key, :reconnecting))}

      %{identity_key: ^identity_key, state: :ended} ->
        {:reply, {:error, :session_ended}, state}

      %{identity_key: ^identity_key} ->
        {:reply, :ok, state}

      _other ->
        {:reply, {:error, :session_identity_mismatch}, state}
    end
  end

  def handle_call({:connect, session_id, identity_key}, _from, state) do
    case Map.get(state, session_id) do
      %{identity_key: ^identity_key, state: :ended} ->
        {:reply, {:error, :session_ended}, state}

      %{identity_key: ^identity_key, epoch: epoch} = existing ->
        next_epoch = epoch + 1
        session = %{existing | state: :active, epoch: next_epoch}
        {:reply, {:ok, next_epoch}, Map.put(state, session_id, session)}

      nil ->
        {:reply, {:ok, 1}, Map.put(state, session_id, session(identity_key))}

      _other ->
        {:reply, {:error, :session_identity_mismatch}, state}
    end
  end

  def handle_call({:current?, session_id, identity_key, epoch}, _from, state) do
    {:reply, current?(state, session_id, identity_key, epoch), state}
  end

  def handle_call({:connection_lost, session_id, identity_key, epoch}, _from, state) do
    case Map.get(state, session_id) do
      %{identity_key: ^identity_key, epoch: ^epoch, state: :active} = existing ->
        {:reply, :ok, Map.put(state, session_id, %{existing | state: :reconnecting})}

      _other ->
        {:reply, :stale, state}
    end
  end

  def handle_call({:leave, session_id, identity_key, epoch}, _from, state) do
    case Map.get(state, session_id) do
      %{identity_key: ^identity_key, epoch: ^epoch, state: state_name} = existing
      when state_name in [:active, :reconnecting] ->
        {:reply, :ok, Map.put(state, session_id, %{existing | state: :ended})}

      _other ->
        {:reply, :stale, state}
    end
  end

  defp current?(state, session_id, identity_key, epoch) do
    match?(
      %{identity_key: ^identity_key, epoch: ^epoch, state: :active},
      Map.get(state, session_id)
    )
  end

  defp session(identity_key, state \\ :active),
    do: %{identity_key: identity_key, epoch: 0, state: state}
end
