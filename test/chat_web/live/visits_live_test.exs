# Назначение файла: LiveView-тесты таблицы входов и выходов за последние 48 часов.
defmodule ChatWeb.VisitsLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Visits

  test "renders recent active and finished visits but excludes older entries", %{conn: conn} do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {:ok, active} = Visits.start_visit("active_user", DateTime.add(now, -1, :hour))
    {:ok, finished} = Visits.start_visit("finished_user", DateTime.add(now, -2, :hour))
    {:ok, _finished} = Visits.finish_visit(finished, DateTime.add(now, -30, :minute))
    {:ok, _old} = Visits.start_visit("old_user", DateTime.add(now, -49, :hour))

    {:ok, view, _html} = live(conn, ~p"/visits")

    assert has_element?(view, "#visits-page")
    assert has_element?(view, "#visits[phx-update='stream']")
    assert has_element?(view, "[data-visit-nickname='#{active.nickname}']")
    assert has_element?(view, "[data-visit-nickname='#{finished.nickname}']")
    refute has_element?(view, "[data-visit-nickname='old_user']")
    assert render(view) =~ "Сейчас в чате"
    assert render(view) =~ "Дата входа"
    assert render(view) =~ "Дата выхода"
  end

  test "formats timestamps for Moscow and handles active visits" do
    assert ChatWeb.VisitsLive.format_datetime(~U[2026-08-17 10:15:00Z]) ==
             "17.08.2026 · 13:15"

    assert ChatWeb.VisitsLive.format_datetime(nil) == "Сейчас в чате"
  end
end
