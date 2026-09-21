defmodule ChatWeb.YouTubeProxyControllerTest do
  use ChatWeb.ConnCase, async: false

  alias Chat.YouTube

  test "starts video preparation without waiting for it", %{conn: conn} do
    previous_config = Application.get_env(:chat, YouTube)
    test_pid = self()

    Application.put_env(:chat, YouTube,
      download_fun: fn _video_id, _path ->
        send(test_pid, {:youtube_download_started, self()})

        receive do
          :finish_youtube_download -> {:error, :download_failed}
        end
      end
    )

    on_exit(fn -> Application.put_env(:chat, YouTube, previous_config) end)

    conn = get(conn, "/youtube-proxy/dQw4w9WgXcQ")

    assert response(conn, 202) == ""
    assert get_resp_header(conn, "retry-after") == ["1"]

    assert_receive {:youtube_download_started, task_pid}
    send(task_pid, :finish_youtube_download)
  end
end
