defmodule Chat.MusicTest do
  use ExUnit.Case, async: false

  alias Chat.Music
  alias Chat.Music.ProxyPool

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

  test "treats a missing MP3mn result page as no results" do
    Req.Test.expect(__MODULE__, fn conn ->
      Plug.Conn.send_resp(conn, 404, "not found")
    end)

    assert {:error, :not_found} = Music.search("Imagine Dragons")
  end

  test "retries directly after every music proxy fails" do
    path = Path.join(System.tmp_dir!(), "music-proxy-#{System.unique_integer([:positive])}.txt")
    File.write!(path, "proxy.example:10000:user:password\n")

    previous_config = Application.get_env(:chat, Music)

    on_exit(fn ->
      Application.put_env(:chat, Music, previous_config)
      ProxyPool.reload()
      File.rm(path)
    end)

    Application.put_env(:chat, Music, Keyword.put(previous_config, :proxy_file, path))
    :ok = ProxyPool.reload()

    Req.Test.expect(__MODULE__, fn conn ->
      Plug.Conn.send_resp(conn, 502, "bad gateway")
    end)

    Req.Test.expect(__MODULE__, fn conn ->
      Req.Test.html(conn, track_markup())
    end)

    assert {:ok, [%{title: "Привет"}]} = Music.search("Bakr Привет")
  end

  test "returns at most fifteen tracks for three preview pages" do
    Req.Test.expect(__MODULE__, fn conn ->
      tracks =
        for index <- 1..16 do
          """
          <li>
            <a class="playlist-play" data-url="https://mn1.sunproxy.net/file/test/track-#{index}.mp3">Прослушать</a>
            <a href="/t/track-#{index}/" class="playlist-down">Скачать</a>
            <span class="playlist-duration">2:30</span>
            <span class="playlist-name-artist"><a>Исполнитель #{index}</a></span>
            <span class="playlist-name-title"><a>Трек #{index}</a></span>
          </li>
          """
        end

      Req.Test.html(conn, "<ul>#{tracks}</ul>")
    end)

    assert {:ok, tracks} = Music.search("тест")
    assert length(tracks) == 15
    assert List.last(tracks).title == "Трек 15"
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

  defp track_markup do
    """
    <ul>
      <li>
        <a class="playlist-play" data-url="https://mn1.sunproxy.net/file/test/Bakr_-_Privet.mp3">Прослушать</a>
        <a href="/t/165-bakr_privet/" class="playlist-down">Скачать</a>
        <span class="playlist-duration">2:35</span>
        <div class="playlist-name-artist"><a>Bakr</a></div>
        <div class="playlist-name-title"><a>Привет</a></div>
      </li>
    </ul>
    """
  end
end
