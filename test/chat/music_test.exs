defmodule Chat.MusicTest do
  use ExUnit.Case, async: false

  alias Chat.Music

  setup do
    previous_config = Application.get_env(:chat, Music)

    Application.put_env(:chat, Music,
      endpoint: "https://mp3mn.net/",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, Music, previous_config) end)
    :ok
  end

  setup {Req.Test, :verify_on_exit!}

  test "search returns playable tracks from MP3mn markup" do
    Req.Test.expect(__MODULE__, fn conn ->
      assert conn.method == "GET"
      assert URI.decode_query(conn.query_string) == %{"song" => "Bakr Привет"}

      Req.Test.html(conn, """
      <ul>
        <li>
          <a class="playlist-play" data-url="https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3">Прослушать</a>
          <a href="/t/165-bakr_privet/" class="playlist-down">Скачать</a>
          <span class="playlist-duration">2:35</span>
          <div class="playlist-name-artist"><a href="/a/bakr/">Bakr</a></div>
          <div class="playlist-name-title"><a href="/t/165-bakr_privet/"><em>Привет</em></a></div>
        </li>
      </ul>
      """)
    end)

    assert {:ok, [%{artist: "Bakr", title: "Привет", duration: "2:35"} = track]} =
             Music.search("Bakr Привет")

    assert track.audio_url == "https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3"
    assert track.source_url == "https://mp3mn.net/t/165-bakr_privet/"
  end

  test "filters tracks whose audio URL is not an allowed sunproxy file" do
    Req.Test.expect(__MODULE__, fn conn ->
      Req.Test.html(conn, ~s(<a data-url="https://example.com/file/nope.mp3"></a>))
    end)

    assert {:error, :not_found} = Music.search("unknown")
  end

  test "normalizes only tracks from trusted MP3mn and Sunproxy URLs" do
    assert {:ok, track} =
             Music.normalize_track(%{
               artist: "Bakr",
               title: "Привет",
               duration: "2:35",
               audio_url: "https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3",
               source_url: "https://mp3mn.net/t/165-bakr_privet/"
             })

    assert track.title == "Привет"

    assert {:error, :invalid_track} =
             Music.normalize_track(%{
               artist: "Bakr",
               title: "Привет",
               duration: "2:35",
               audio_url: "https://example.com/file/track.mp3",
               source_url: "https://mp3mn.net/t/165-bakr_privet/"
             })
  end

  test "validates search query before making a request" do
    assert {:error, :query_required} = Music.search("  ")
    assert {:error, :query_too_long} = Music.search(String.duplicate("a", 121))
  end
end
