# Назначение файла: проверка фактической сигнатуры разрешённых растровых изображений.
defmodule Chat.Uploads do
  @moduledoc false

  def valid_image?(<<0xFF, 0xD8, 0xFF, _rest::binary>>, "image/jpeg"), do: true

  def valid_image?(<<0x89, "PNG\r\n", 0x1A, "\n", _rest::binary>>, "image/png"), do: true

  def valid_image?(<<"RIFF", _size::binary-size(4), "WEBP", _rest::binary>>, "image/webp"),
    do: true

  def valid_image?(<<"GIF87a", _rest::binary>>, "image/gif"), do: true
  def valid_image?(<<"GIF89a", _rest::binary>>, "image/gif"), do: true

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

  def image_dimensions(<<0x89, "PNG\r\n", 0x1A, "\n", _rest::binary>> = image, "image/png"),
    do: png_dimensions(image)

  def image_dimensions(
        <<header::binary-size(6), width::little-unsigned-16, height::little-unsigned-16,
          _rest::binary>>,
        "image/gif"
      )
      when header in ["GIF87a", "GIF89a"],
      do: {:ok, {width, height}}

  def image_dimensions(
        <<"RIFF", _size::binary-size(4), "WEBP", "VP8X", _chunk_size::little-unsigned-32, _flags,
          width_minus_one::little-unsigned-24, height_minus_one::little-unsigned-24,
          _rest::binary>>,
        "image/webp"
      ),
      do: {:ok, {width_minus_one + 1, height_minus_one + 1}}

  def image_dimensions(
        <<"RIFF", _size::binary-size(4), "WEBP", "VP8 ", _chunk_size::little-unsigned-32,
          _frame_tag::binary-size(3), 0x9D, 0x01, 0x2A, width::little-unsigned-16,
          height::little-unsigned-16, _rest::binary>>,
        "image/webp"
      ),
      do: {:ok, {Bitwise.band(width, 0x3FFF), Bitwise.band(height, 0x3FFF)}}

  def image_dimensions(_image, _content_type), do: :error

  def animated?(<<"GIF87a", _rest::binary>>, "image/gif"), do: true
  def animated?(<<"GIF89a", _rest::binary>>, "image/gif"), do: true

  def animated?(<<"RIFF", _size::binary-size(4), "WEBP", _before::binary>> = image, "image/webp"),
    do: :binary.match(image, "ANIM") != :nomatch

  def animated?(_image, _content_type), do: false
end
