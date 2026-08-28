# Назначение файла: LiveView-тест страницы шашек и её ключевых состояний.
defmodule ChatWeb.CheckersLiveTest do
  use ChatWeb.ConnCase, async: true

  test "renders authentication state and stable game containers", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/checkers")
    assert has_element?(view, "#checkers-page")
    assert has_element?(view, "#checkers-auth-check")
    render_hook(view, "authenticate_checkers", %{})
    assert has_element?(view, "#checkers-login-hint")
  end
end
