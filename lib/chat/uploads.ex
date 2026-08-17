# Назначение файла: проверка фактической сигнатуры разрешённых растровых изображений.
defmodule Chat.Uploads do
  @moduledoc false

  def valid_image?(<<0xFF, 0xD8, 0xFF, _rest::binary>>, "image/jpeg"), do: true

  def valid_image?(<<0x89, "PNG\r\n", 0x1A, "\n", _rest::binary>>, "image/png"), do: true

  def valid_image?(<<"RIFF", _size::binary-size(4), "WEBP", _rest::binary>>, "image/webp"),
    do: true

  def valid_image?(_bytes, _content_type), do: false
end
