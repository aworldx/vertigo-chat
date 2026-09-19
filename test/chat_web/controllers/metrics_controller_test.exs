defmodule ChatWeb.MetricsControllerTest do
  use ChatWeb.ConnCase, async: false

  test "does not expose metrics without a bearer token", %{conn: conn} do
    conn = get(conn, "/internal/metrics")

    assert response(conn, 401) == "unauthorized"
  end

  test "exports only aggregate Prometheus metrics to an authorized scraper", %{conn: conn} do
    Chat.Metrics.increment(:public_messages, %{kind: :text})

    conn =
      conn
      |> put_req_header("authorization", "Bearer test-metrics-token")
      |> get("/internal/metrics")

    body = response(conn, 200)

    assert get_resp_header(conn, "content-type") == ["text/plain; charset=utf-8"]
    assert body =~ "chat_beam_memory_bytes"
    assert body =~ "chat_sessions"
    assert body =~ "chat_public_messages_total{kind=\"text\"}"
    refute body =~ "test-metrics-token"
  end
end
