# Назначение файла: проверяет устойчивые и идемпотентные переходы чат-сессии.
defmodule Chat.Sessions.StoreTest do
  use Chat.DataCase, async: true

  alias Chat.Repo
  alias Chat.Sessions.ChatSession
  alias Chat.Sessions.Store

  test "only the current generation can enter reconnecting" do
    session = create_session()

    assert {:ok, _deadline} =
             Store.reconnect(session.id, session.identity_key, session.generation)

    assert :stale = Store.reconnect(session.id, session.identity_key, session.generation)
  end

  test "only one worker can expire a reconnecting session" do
    session =
      create_session(%{
        status: "reconnecting",
        reconnect_deadline_at: DateTime.add(DateTime.utc_now(), -1, :second)
      })

    assert :ended = Store.expire(session)
    assert :stale = Store.expire(session)
    assert "ended" == Repo.get!(ChatSession, session.id).status
  end

  defp create_session(overrides \\ %{}) do
    secret = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    attrs =
      Map.merge(
        %{
          room_id: "store-room-#{System.unique_integer([:positive])}",
          identity_key: "guest:#{Ecto.UUID.generate()}",
          nickname: "store_guest",
          resume_secret_hash: Store.hash_secret(secret),
          status: "active",
          last_seen_at: now,
          generation: 0
        },
        overrides
      )

    %ChatSession{}
    |> ChatSession.create_changeset(attrs)
    |> Repo.insert!()
  end
end
