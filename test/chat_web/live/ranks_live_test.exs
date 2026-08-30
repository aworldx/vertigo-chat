# Назначение файла: LiveView-тесты страницы киношных званий.
defmodule ChatWeb.RanksLiveTest do
  use ChatWeb.ConnCase

  test "renders all rank requirements", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/help")

    assert has_element?(view, "#help-page")
    assert has_element?(view, "#commands-list", "/помощь")
    assert has_element?(view, "#commands-list", "/игнор ник")
    assert has_element?(view, "#ranks-list")
    assert has_element?(view, "#ranks-list > #rank-10[data-rank-title='Режиссер']")
    assert has_element?(view, "#rank-2", "50 фраз")
    assert has_element?(view, "#rank-2", "5 ч.")
    assert has_element?(view, "#rank-10", "35 000 фраз")
    assert has_element?(view, "#rank-10", "3 500 ч.")
    assert has_element?(view, "#rank-2", "Можно добавлять статьи в библиотеку")
    assert has_element?(view, "#rank-3", "Можно добавлять фотографии в фотоальбом")
    assert has_element?(view, "#rank-1 img[src='/images/ranks/ticket.svg']")
    assert has_element?(view, "#rank-10 img[src='/images/ranks/theater.svg']")
    assert has_element?(view, "#rank-icons-credit", "Tabler Icons")
  end
end
