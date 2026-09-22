defmodule Chat.YouTubeTest do
  use ExUnit.Case, async: false

  alias Chat.YouTube

  setup {Req.Test, :verify_on_exit!}

  test "normalizes watch, short and shorts links" do
    for link <- [
          "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          "https://youtu.be/dQw4w9WgXcQ?t=42",
          "https://m.youtube.com/shorts/dQw4w9WgXcQ"
        ] do
      assert {:ok, %{id: "dQw4w9WgXcQ", source_url: source_url}} = YouTube.normalize_link(link)
      assert source_url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    end
  end

  test "rejects non-YouTube links and malformed video ids" do
    assert {:error, :invalid_youtube} =
             YouTube.normalize_link("https://example.com/watch?v=dQw4w9WgXcQ")

    assert {:error, :invalid_youtube} = YouTube.normalize_link("https://youtu.be/not-a-video-id")
  end

  test "returns up to five searchable videos within the duration limit" do
    previous_config = Application.get_env(:chat, Chat.YouTube)

    Application.put_env(:chat, Chat.YouTube,
      search_resolver: fn _query ->
        {:ok,
         [
           %{"id" => "dQw4w9WgXcQ", "title" => "Короткий ролик", "duration" => 120},
           %{"id" => "9bZkp7q19f0", "title" => "Слишком длинный", "duration" => 1_201}
         ]}
      end
    )

    on_exit(fn -> Application.put_env(:chat, Chat.YouTube, previous_config) end)

    assert {:ok, [%{id: "dQw4w9WgXcQ", title: "Короткий ролик", duration: 120}]} =
             YouTube.search("короткий ролик")
  end

  test "delegates search to the isolated YouTube worker" do
    previous_config = Application.get_env(:chat, YouTube)

    Application.put_env(:chat, YouTube,
      worker_url: "http://youtube-worker.test",
      worker_plug: {Req.Test, __MODULE__}
    )

    on_exit(fn -> Application.put_env(:chat, YouTube, previous_config) end)

    Req.Test.expect(__MODULE__, fn conn ->
      assert conn.method == "POST"
      assert conn.request_path == "/youtube/search"
      assert %{"query" => "короткий ролик"} = conn |> Req.Test.raw_body() |> Jason.decode!()

      Req.Test.json(conn, %{
        "videos" => [
          %{"id" => "dQw4w9WgXcQ", "title" => "Короткий ролик", "duration" => 120}
        ]
      })
    end)

    assert {:ok, [%{id: "dQw4w9WgXcQ", title: "Короткий ролик", duration: 120}]} =
             YouTube.search("короткий ролик")
  end

  test "uses the local proxy route" do
    assert YouTube.proxy_url("dQw4w9WgXcQ") == "/youtube-proxy/dQw4w9WgXcQ"
  end
end
