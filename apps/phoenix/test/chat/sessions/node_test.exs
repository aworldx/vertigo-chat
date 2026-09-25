# These tests start two complete applications on separate BEAM VMs. Each test
# gets a newly created PostgreSQL database, destroyed after both nodes stop.
defmodule Chat.Sessions.NodeTest do
  use ExUnit.Case, async: false

  alias Chat.SessionNode

  @moduletag timeout: 90_000

  setup do
    database = "chat_session_test_" <> String.replace(Ecto.UUID.generate(), "-", "")

    repo_config =
      Application.fetch_env!(:chat, Chat.Repo)
      |> Keyword.put(:database, database)
      |> Keyword.put(:pool, DBConnection.ConnectionPool)
      |> Keyword.put(:pool_size, 4)

    :ok = Ecto.Adapters.Postgres.storage_up(repo_config)
    on_exit(fn -> :ok = Ecto.Adapters.Postgres.storage_down(repo_config) end)

    config = [chat: Application.get_all_env(:chat) |> Keyword.put(Chat.Repo, repo_config)]
    first = start_node(:first, config, true)
    second = start_node(:second, config, false)
    tasks = start_supervised!(Task.Supervisor)

    %{
      first: first,
      second: second,
      config: config,
      tasks: tasks,
      room: "node-#{Ecto.UUID.generate()}"
    }
  end

  test "a full VM restart preserves active and reconnecting sessions and terminal leave", ctx do
    {:ok, session} = call(ctx.first, {:enter, ctx.room, "restart_guest", ""})
    stop_supervised!({:session_node, :first})
    restarted = start_node(:first, ctx.config, false)
    {:ok, restored} = call(restarted, {:restore, session})
    assert restored.visit.id == session.visit.id
    assert restored.connection_epoch > session.connection_epoch

    :ok = call(restarted, {:disconnect, restored})
    [pending] = call(ctx.second, {:snapshot, ctx.room}).sessions
    stop_supervised!({:session_node, :first})
    restarted = start_node(:first, ctx.config, false)
    assert [%{reconnect_deadline_at: deadline}] = call(restarted, {:snapshot, ctx.room}).sessions
    assert deadline == pending.reconnect_deadline_at
    {:ok, restored} = call(restarted, {:restore, restored})
    :ok = call(restarted, {:leave, restored})

    stop_supervised!({:session_node, :first})
    restarted = start_node(:first, ctx.config, false)
    assert {:error, :session_ended} = call(restarted, {:restore, restored})

    assert %{visits: [%{left_at: %DateTime{}}], messages: [_]} =
             call(restarted, {:snapshot, ctx.room})
  end

  test "two nodes entering the same registered identity leave one current session and visit",
       ctx do
    {:ok, _user} = call(ctx.first, {:register, "racing_member"})

    results =
      race(
        ctx,
        {:enter, ctx.room, "racing_member", "integration123"},
        {:enter, ctx.room, "racing_member", "integration123"}
      )

    # Legacy password login intentionally takes over an existing session (also
    # covered by RoomLiveTest). The loser can fail before creation, lose its
    # generation before connect, or connect before the next login takes over.
    successful = for {:ok, session} <- results, do: session
    assert successful != []

    for {:error, reason} <- results do
      assert reason in [:nickname_online, :stale_connection]
    end

    %{sessions: sessions, visits: visits} = call(ctx.first, {:snapshot, ctx.room})
    assert [current] = Enum.filter(sessions, &(&1.status == "active"))
    assert [open_visit] = Enum.filter(visits, &is_nil(&1.left_at))
    assert current.visit_id == open_visit.id
    assert Enum.all?(sessions, &(&1.status in ["active", "ended"]))
    assert length(sessions) == length(visits)

    for session <- successful do
      expected = if session.session_id == current.id, do: :ok, else: :stale
      assert call(ctx.first, {:touch, session, DateTime.utc_now()}) == expected
    end
  end

  test "two reapers close an expired session once after its owning VM stops", ctx do
    {:ok, session} = call(ctx.first, {:enter, ctx.room, "expired_guest", ""})
    :ok = call(ctx.first, {:disconnect, session})
    [pending] = call(ctx.second, {:snapshot, ctx.room}).sessions
    stop_supervised!({:session_node, :first})
    restarted = start_node(:first, ctx.config, false)
    ctx = %{ctx | first: restarted}

    assert [:ok, :ok] =
             race(
               ctx,
               {:reap, pending.reconnect_deadline_at},
               {:reap, pending.reconnect_deadline_at}
             )

    assert %{sessions: [%{status: "ended"}], visits: [%{left_at: %DateTime{}}], messages: [_]} =
             call(restarted, {:snapshot, ctx.room})

    assert {:error, :session_ended} = call(ctx.second, {:restore, session})
  end

  test "restore and expiry on separate nodes cannot resurrect an ended session", ctx do
    for index <- 1..5 do
      room = ctx.room <> "-#{index}"
      {:ok, session} = call(ctx.first, {:enter, room, "restore_race", ""})
      :ok = call(ctx.first, {:disconnect, session})
      [pending] = call(ctx.second, {:snapshot, room}).sessions

      results =
        race(
          ctx,
          {:restore_at, session, DateTime.add(pending.reconnect_deadline_at, -1)},
          {:reap, pending.reconnect_deadline_at}
        )

      snapshot = call(ctx.first, {:snapshot, room})

      case snapshot.sessions do
        [%{status: "active"}] ->
          assert Enum.any?(results, &match?({:ok, _}, &1))
          assert [%{left_at: nil}] = snapshot.visits
          assert [] = snapshot.messages

        [%{status: "ended"}] ->
          assert {:error, :session_ended} in results
          assert [%{left_at: %DateTime{}}] = snapshot.visits
          assert [_] = snapshot.messages
      end
    end
  end

  test "late leave and heartbeat from another node cannot change the restored generation", ctx do
    {:ok, session} = call(ctx.first, {:enter, ctx.room, "stale_guest", ""})
    {:ok, restored} = call(ctx.second, {:restore, session})
    assert :ok = call(ctx.first, {:leave, session})
    assert :ok = call(ctx.first, {:disconnect, session})
    assert :stale = call(ctx.first, {:touch, session, DateTime.utc_now()})

    assert %{sessions: [%{status: "active", generation: generation}], visits: [%{left_at: nil}]} =
             call(ctx.second, {:snapshot, ctx.room})

    assert generation == restored.connection_epoch
  end

  test "a crashed node with no terminate leaves an active lease that expires after restart",
       ctx do
    {:ok, session} = call(ctx.first, {:enter, ctx.room, "lost_heartbeat", ""})
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    :ok = call(ctx.first, {:touch, session, DateTime.add(now, -241)})
    stop_supervised!({:session_node, :first})
    assert :ok = call(ctx.second, {:reap, now})
    restarted = start_node(:first, ctx.config, false)
    assert {:error, :session_ended} = call(restarted, {:restore, session})

    assert %{sessions: [%{status: "ended"}], messages: [_], visits: [%{left_at: %DateTime{}}]} =
             call(restarted, {:snapshot, ctx.room})
  end

  defp start_node(label, config, migrate?) do
    args = [~c"+S", ~c"2", ~c"-pa" | :code.get_path()]

    node =
      start_supervised!(%{
        id: {:session_node, label},
        start: {:peer, :start_link, [%{connection: :standard_io, args: args, wait_boot: 15_000}]}
      })

    :ok = :peer.call(node, SessionNode, :boot, [config, migrate?], 30_000)
    node
  end

  defp call(node, command),
    do: :peer.call(node, GenServer, :call, [SessionNode, command, 20_000], 25_000)

  defp race(ctx, first, second) do
    parent = self()

    tasks =
      for {node, command} <- [{ctx.first, first}, {ctx.second, second}] do
        Task.Supervisor.async_nolink(ctx.tasks, fn ->
          send(parent, {:ready, self()})

          receive do
            :go -> call(node, command)
          end
        end)
      end

    for _ <- tasks do
      assert_receive {:ready, _}, 5_000
    end

    Enum.each(tasks, &send(&1.pid, :go))
    Enum.map(tasks, &Task.await(&1, 30_000))
  end
end
