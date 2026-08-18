# Назначение файла: проверяет маскирование чувствительных WebRTC-параметров в логах Phoenix.
defmodule ChatWeb.LogFilterTest do
  use ExUnit.Case, async: true

  test "filters SDP, ICE candidates and authentication secrets recursively" do
    params = %{
      "password" => "secret",
      "token" => "signed-token",
      "payload" => %{
        "sdp" => "v=0\r\n",
        "candidate" => "candidate:1 1 UDP 1 203.0.113.1 9999 typ host",
        "media_chunk" => "base64-media-bytes"
      }
    }

    assert Phoenix.Logger.filter_values(params) == %{
             "password" => "[FILTERED]",
             "token" => "[FILTERED]",
             "payload" => %{
               "sdp" => "[FILTERED]",
               "candidate" => "[FILTERED]",
               "media_chunk" => "[FILTERED]"
             }
           }
  end
end
