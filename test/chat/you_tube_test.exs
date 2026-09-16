defmodule Chat.YouTubeTest do
  use ExUnit.Case, async: true

  alias Chat.YouTube

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

  test "uses the local proxy route" do
    assert YouTube.proxy_url("dQw4w9WgXcQ") == "/youtube-proxy/dQw4w9WgXcQ"
  end
end
