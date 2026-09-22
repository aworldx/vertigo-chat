defmodule Chat.YouTube.WorkerTest do
  use ExUnit.Case, async: false

  import Plug.Test

  alias Chat.YouTube
  alias Chat.YouTube.Cache
  alias Chat.YouTube.Worker

  setup do
    previous_config = Application.get_env(:chat, YouTube)

    cache_dir =
      Path.join(
        System.tmp_dir!(),
        "chat-youtube-worker-test-#{System.unique_integer([:positive])}"
      )

    test_pid = self()

    Application.put_env(:chat, YouTube,
      cache_dir: cache_dir,
      cache_max_preparations: 1,
      download_fun: fn video_id, _path ->
        send(test_pid, {:youtube_download_started, video_id, self()})

        receive do
          {:finish_download, ^video_id} -> {:error, :download_failed}
        end
      end
    )

    start_supervised!(Cache)

    on_exit(fn ->
      Application.put_env(:chat, YouTube, previous_config)
      File.rm_rf(cache_dir)
    end)

    :ok
  end

  test "returns accepted while a video is being prepared" do
    conn = conn(:get, "/youtube-proxy/dQw4w9WgXcQ") |> Worker.call([])

    assert conn.status == 202
    assert Plug.Conn.get_resp_header(conn, "retry-after") == ["1"]
    assert_receive {:youtube_download_started, "dQw4w9WgXcQ", task_pid}
    send(task_pid, {:finish_download, "dQw4w9WgXcQ"})
  end

  test "searches through the worker-local yt-dlp resolver" do
    Application.put_env(:chat, YouTube,
      search_resolver: fn "короткий ролик" ->
        {:ok, [%{"id" => "dQw4w9WgXcQ", "title" => "Короткий ролик", "duration" => 120}]}
      end
    )

    conn =
      conn(:post, "/youtube/search", Jason.encode!(%{"query" => "короткий ролик"}))
      |> Plug.Conn.put_req_header("content-type", "application/json")
      |> Worker.call([])

    assert conn.status == 200
    assert %{"videos" => [%{"id" => "dQw4w9WgXcQ"}]} = Jason.decode!(conn.resp_body)
  end

  test "prepares only one distinct video and queues the next one" do
    assert :pending = Cache.request("first-video")
    assert_receive {:youtube_download_started, "first-video", first_task}

    assert :pending = Cache.request("second_vid1")
    assert %{active_preparations: 1, queued_preparations: 1} = Cache.stats()

    send(first_task, {:finish_download, "first-video"})

    assert_receive {:youtube_download_started, "second_vid1", second_task}
    send(second_task, {:finish_download, "second_vid1"})
  end
end
