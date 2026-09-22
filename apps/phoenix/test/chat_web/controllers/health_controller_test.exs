# Назначение файла: проверка технического endpoint для Docker healthcheck.
defmodule ChatWeb.HealthControllerTest do
  use ChatWeb.ConnCase, async: true

  test "returns a lightweight readiness response", %{conn: conn} do
    conn = get(conn, "/health")

    assert response(conn, 200) == "ok"
  end
end
