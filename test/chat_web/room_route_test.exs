# Назначение файла: smoke-тест маршрута главной страницы чата.
defmodule ChatWeb.RoomRouteTest do
  use ChatWeb.ConnCase

  test "GET / renders the chat", %{conn: conn} do
    conn = get(conn, ~p"/")

    assert html_response(conn, 200) =~ "Vertigo"
  end
end
