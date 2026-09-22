# Назначение файла: тесты проверки MIME-типа и фактической сигнатуры изображений.
defmodule Chat.UploadsTest do
  use ExUnit.Case, async: true

  alias Chat.Uploads

  test "accepts only matching raster image signatures" do
    assert Uploads.valid_image?(<<0xFF, 0xD8, 0xFF, "jpeg">>, "image/jpeg")
    assert Uploads.valid_image?(<<0x89, "PNG\r\n", 0x1A, "\n", "png">>, "image/png")
    assert Uploads.valid_image?(<<"RIFF", 0, 0, 0, 0, "WEBP", "webp">>, "image/webp")

    refute Uploads.valid_image?(<<"<svg onload=alert(1)>">>, "image/svg+xml")
    refute Uploads.valid_image?(<<0xFF, 0xD8, 0xFF, "jpeg">>, "image/png")
  end
end
