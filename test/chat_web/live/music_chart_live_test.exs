# Назначение файла: LiveView-тесты страницы музыкального хит-парада.
defmodule ChatWeb.MusicChartLiveTest do
  use ChatWeb.ConnCase

  alias Chat.Accounts
  alias Chat.MusicChart

  test "shows the invitation and account login without a chat entry button", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/music-chart")

    assert has_element?(view, "#music-chart-page", "Хит-парад")
    refute has_element?(view, "#music-chart-enter-chat")
    assert has_element?(view, "#music-chart-account-login[action='/account/login']", "Войти")
    assert has_element?(view, "#music-chart-tracks[phx-update='stream']")
  end

  test "lets a registered chatlan upload a track and vote for another one", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "chart_live_author", "password" => "secret123"})

    {:ok, voter} =
      Accounts.register_user(%{"nickname" => "chart_live_voter", "password" => "secret123"})

    assert {:ok, track} = MusicChart.add_track(author, "Ночная песня", mp3_bytes(), "audio/mpeg")

    {:ok, view, _html} =
      live(init_test_session(conn, account_user_id: voter.id), ~p"/music-chart")

    assert has_element?(view, "#music-like-#{track.id}[aria-pressed='false']")
    view |> element("#music-like-#{track.id}") |> render_click()
    assert has_element?(view, "#music-like-#{track.id}[aria-pressed='true']")

    upload =
      file_input(view, "#music-chart-upload-form", :music_track, [
        %{name: "my-song.mp3", content: mp3_bytes(), type: "audio/mpeg"}
      ])

    render_upload(upload, "my-song.mp3")

    view
    |> form("#music-chart-upload-form", music_chart: %{title: "Моя песня"})
    |> render_submit()

    assert has_element?(view, "[data-track-title='Моя песня']", "Добавил chart_live_voter")
  end

  test "lets a registered chatlan leave a short comment", %{conn: conn} do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "chart_comment_author", "password" => "secret123"})

    {:ok, listener} =
      Accounts.register_user(%{"nickname" => "chart_comment_listener", "password" => "secret123"})

    assert {:ok, track} =
             MusicChart.add_track(author, "Трек с комментариями", mp3_bytes(), "audio/mpeg")

    {:ok, view, _html} =
      live(init_test_session(conn, account_user_id: listener.id), ~p"/music-chart")

    view
    |> form("#music-comment-form-#{track.id}", music_comment: %{body: "Классный трек"})
    |> render_submit()

    assert has_element?(view, "#music-track-comments-#{track.id}", "Классный трек")
    assert has_element?(view, "#music-track-comments-#{track.id}", "chart_comment_listener")
  end

  defp mp3_bytes, do: <<"ID3", 4, 0, 0, 0, 0, 0, 0, 0, 0>>
end
