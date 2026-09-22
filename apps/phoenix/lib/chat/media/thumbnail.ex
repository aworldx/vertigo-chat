defmodule Chat.Media.Thumbnail do
  @moduledoc "Creates bounded 480px WebP previews using ImageMagick."

  def generate(bytes) do
    directory = Path.join(System.tmp_dir!(), "chat-thumbnail-" <> Ecto.UUID.generate())
    File.mkdir_p!(directory)
    File.chmod!(directory, 0o700)
    input = Path.join(directory, "input")
    output = Path.join(directory, "thumbnail.webp")

    try do
      File.write!(input, bytes)
      executable = System.find_executable("magick") || System.find_executable("convert")

      format =
        cond do
          Chat.Uploads.valid_image?(bytes, "image/jpeg") -> "jpeg"
          Chat.Uploads.valid_image?(bytes, "image/png") -> "png"
          Chat.Uploads.valid_image?(bytes, "image/webp") -> "webp"
          true -> nil
        end

      if executable && format do
        args = [
          "-limit",
          "memory",
          "64MiB",
          "-limit",
          "map",
          "128MiB",
          "-limit",
          "disk",
          "256MiB",
          "-limit",
          "time",
          "15",
          "#{format}:#{input}[0]",
          "-auto-orient",
          "-thumbnail",
          "480x480>",
          "-strip",
          "-quality",
          "75",
          output
        ]

        case System.cmd(executable, args, stderr_to_stdout: true) do
          {_, 0} -> File.read(output)
          _ -> {:error, :invalid_image}
        end
      else
        {:error, :image_processor_unavailable}
      end
    after
      File.rm_rf!(directory)
    end
  end
end
