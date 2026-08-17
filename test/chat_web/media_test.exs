# Назначение файла: тесты web-представления бинарных изображений.
defmodule ChatWeb.MediaTest do
  use ExUnit.Case, async: true

  alias ChatWeb.Media

  test "builds a data URL and preserves an absent image" do
    assert Media.data_url(<<1, 2, 3>>, "image/webp") == "data:image/webp;base64,AQID"
    assert Media.data_url(nil, nil) == nil
  end
end
