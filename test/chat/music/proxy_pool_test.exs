defmodule Chat.Music.ProxyPoolTest do
  use ExUnit.Case, async: false

  alias Chat.Music
  alias Chat.Music.ProxyPool

  test "prefers healthy proxies and temporarily deprioritizes failures" do
    path =
      Path.join(System.tmp_dir!(), "chat-music-proxies-#{System.unique_integer([:positive])}.txt")

    File.write!(path, """
    proxy-a.example:10000:test-a:secret-a
    proxy-b.example:10001:test-b:secret-b
    malformed proxy
    """)

    previous_config = Application.get_env(:chat, Music)

    on_exit(fn ->
      Application.put_env(:chat, Music, previous_config)
      ProxyPool.reload()
      File.rm(path)
    end)

    Application.put_env(:chat, Music, Keyword.put(previous_config, :proxy_file, path))
    :ok = ProxyPool.reload()

    [first] = ProxyPool.candidates(1)
    assert first.host in ["proxy-a.example", "proxy-b.example"]

    assert first.authorization in [
             "Basic " <> Base.encode64("test-a:secret-a"),
             "Basic " <> Base.encode64("test-b:secret-b")
           ]

    :ok = ProxyPool.report_failure(first.id)
    [second] = ProxyPool.candidates(1)
    assert second.id != first.id
  end
end
