defmodule Chat.GifsTest do
  use ExUnit.Case, async: false

  alias Chat.Gifs

  setup do
    previous_config = Application.get_env(:chat, Gifs)

    Application.put_env(:chat, Gifs,
      endpoint: "https://gifsnap.com/api/v1/gifs/search",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, Gifs, previous_config) end)
    :ok
  end

  setup {Req.Test, :verify_on_exit!}

  test "search returns only trusted GIF media URLs" do
    Req.Test.expect(__MODULE__, fn conn ->
      assert URI.decode_query(conn.query_string)["q"] == "аплодисменты"

      Req.Test.json(conn, %{
        "data" => [
          %{
            "id" => "giphy_123",
            "title" => "Аплодисменты",
            "url" => "https://gifsnap.com/api/v1/media/animated-gif",
            "preview_url" => "https://gifsnap.com/api/v1/media/preview-gif",
            "width" => 480,
            "height" => 270
          },
          %{
            "id" => "unsafe",
            "title" => "Unsafe",
            "url" => "https://example.com/gif",
            "preview_url" => "https://example.com/preview"
          }
        ]
      })
    end)

    assert {:ok, [gif]} = Gifs.search("аплодисменты")
    assert gif.id == "giphy_123"
    assert gif.title == "Аплодисменты"
    assert gif.width == 480
  end

  test "rejects an empty or overly long query before making a request" do
    assert {:error, :query_required} = Gifs.search(" ")
    assert {:error, :query_too_long} = Gifs.search(String.duplicate("г", 81))
  end

  test "accepts GIF provider CDN media URLs but no arbitrary host" do
    assert Gifs.valid_media_url?("https://static.klipy.com/path/to/animated.webp")
    assert Gifs.valid_media_url?("https://pub-example.r2.dev/gifs/animated.webp")
    assert Gifs.valid_media_url?("https://pub-example.r2.dev/thumbnails/animated.webp")
    refute Gifs.valid_media_url?("https://example.com/path/to/animated.webp")
    refute Gifs.valid_media_url?("https://example.r2.dev/gifs/animated.webp")
  end

  test "builds a same-origin proxy URL for trusted GIF media" do
    assert Gifs.proxy_url("https://static.klipy.com/path/to/animated.webp") ==
             "/gif-proxy?url=https%3A%2F%2Fstatic.klipy.com%2Fpath%2Fto%2Fanimated.webp"
  end
end
