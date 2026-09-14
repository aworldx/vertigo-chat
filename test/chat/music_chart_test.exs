# Назначение файла: тесты правил загрузки и голосования в музыкальном хит-параде.
defmodule Chat.MusicChartTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.MusicChart

  test "stores tracks, ranks them by likes, and records the voter state" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "chart_author", "password" => "secret123"})

    {:ok, voter} =
      Accounts.register_user(%{"nickname" => "chart_voter", "password" => "secret123"})

    assert {:ok, first} = MusicChart.add_track(author, "Первый трек", mp3_bytes(), "audio/mpeg")
    assert {:ok, second} = MusicChart.add_track(author, "Второй трек", mp3_bytes(), "audio/mpeg")
    assert {:ok, :liked} = MusicChart.toggle_like(voter, second.id)

    [top, bottom] = MusicChart.list_tracks(voter)
    assert top.id == second.id
    assert top.likes_count == 1
    assert top.liked?
    assert bottom.id == first.id
    refute bottom.liked?
  end

  test "limits every author to five audio tracks" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "chart_limit", "password" => "secret123"})

    for number <- 1..MusicChart.max_tracks_per_user() do
      assert {:ok, _track} =
               MusicChart.add_track(author, "Трек #{number}", mp3_bytes(), "audio/mpeg")
    end

    assert {:error, :track_limit_reached} =
             MusicChart.add_track(author, "Шестой", mp3_bytes(), "audio/mpeg")
  end

  test "rejects invalid audio and an author's vote for their own track" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "chart_rules", "password" => "secret123"})

    assert {:error, :invalid_audio} =
             MusicChart.add_track(author, "Файл", "не аудио", "audio/mpeg")

    assert {:ok, track} = MusicChart.add_track(author, "Мой трек", mp3_bytes(), "audio/mpeg")
    assert {:error, :own_track} = MusicChart.toggle_like(author, track.id)
  end

  test "stores short comments under a track" do
    {:ok, author} =
      Accounts.register_user(%{"nickname" => "comment_track_author", "password" => "secret123"})

    {:ok, listener} =
      Accounts.register_user(%{"nickname" => "comment_listener", "password" => "secret123"})

    assert {:ok, track} =
             MusicChart.add_track(author, "Трек с отзывом", mp3_bytes(), "audio/mpeg")

    assert {:ok, comment} = MusicChart.add_comment(listener, track.id, "  Очень нравится  ")
    assert comment.body == "Очень нравится"
    assert comment.user.nickname == "comment_listener"

    [stored_track] = MusicChart.list_tracks(listener)
    assert [%{body: "Очень нравится"}] = stored_track.comments

    assert {:error, _changeset} = MusicChart.add_comment(listener, track.id, " ")

    assert {:error, _changeset} =
             MusicChart.add_comment(listener, track.id, String.duplicate("я", 281))
  end

  defp mp3_bytes, do: <<"ID3", 4, 0, 0, 0, 0, 0, 0, 0, 0>>
end
