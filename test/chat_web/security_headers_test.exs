# Назначение файла: проверяет защитные HTTP-заголовки для страниц приложения.
defmodule ChatWeb.SecurityHeadersTest do
  use ChatWeb.ConnCase, async: true

  test "sets a restrictive content security policy", %{conn: conn} do
    conn = get(conn, ~p"/")

    assert [policy] = get_resp_header(conn, "content-security-policy")
    assert policy =~ "script-src 'self'"
    assert policy =~ "img-src 'self' data: blob:"
    assert policy =~ "object-src 'none'"
    assert policy =~ "frame-ancestors 'none'"
  end
end
