# Назначение файла: проверка фактической сигнатуры разрешённых растровых изображений.
defmodule Chat.Uploads do
  @moduledoc false

  def valid_image?(<<0xFF, 0xD8, 0xFF, _rest::binary>>, "image/jpeg"), do: true

  def valid_image?(<<0x89, "PNG\r\n", 0x1A, "\n", _rest::binary>>, "image/png"), do: true

  def valid_image?(<<"RIFF", _size::binary-size(4), "WEBP", _rest::binary>>, "image/webp"),
    do: true

  def valid_image?(_bytes, _content_type), do: false

  def valid_audio?(<<"ID3", _rest::binary>>, "audio/mpeg"), do: true

  def valid_audio?(<<0xFF, header, _rest::binary>>, "audio/mpeg") when header in 0xE2..0xFB,
    do: true

  def valid_audio?(<<"OggS", _rest::binary>>, "audio/ogg"), do: true

  def valid_audio?(<<"RIFF", _size::binary-size(4), "WAVE", _rest::binary>>, "audio/wav"),
    do: true

  def valid_audio?(_bytes, _content_type), do: false

  def png_dimensions(
        <<0x89, "PNG\r\n", 0x1A, "\n", _length::binary-size(4), "IHDR", width::32, height::32,
          _rest::binary>>
      ),
      do: {:ok, {width, height}}

  def png_dimensions(_image), do: :error
end
