defmodule Chat.Emojis do
  @moduledoc "Смайлы, которыми администраторы дополняют сообщения чата."

  import Ecto.Query

  alias Chat.Emojis.Emoji
  alias Chat.Repo
  alias Chat.Uploads

  @topic "emojis"
  @max_size 30
  @max_bytes 100_000

  def list, do: Repo.all(from emoji in Emoji, order_by: [asc: emoji.code])
  def get(id) when is_integer(id) and id > 0, do: Repo.get(Emoji, id)
  def get(_id), do: nil

  def create(code, image, content_type)
      when is_binary(code) and is_binary(image) and is_binary(content_type) do
    with :ok <- validate_image(image, content_type),
         {:ok, emoji} <-
           %Emoji{} |> Emoji.create_changeset(code, image, content_type) |> Repo.insert() do
      Phoenix.PubSub.broadcast(Chat.PubSub, @topic, {:emoji_created, emoji})
      {:ok, emoji}
    end
  end

  def create(_code, _image, _content_type), do: {:error, :invalid_emoji}

  def subscribe, do: Phoenix.PubSub.subscribe(Chat.PubSub, @topic)
  def max_size, do: @max_size

  defp validate_image(image, "image/png") when byte_size(image) <= @max_bytes do
    case Uploads.png_dimensions(image) do
      {:ok, {width, height}} when width <= @max_size and height <= @max_size -> :ok
      {:ok, _dimensions} -> {:error, :too_large_dimensions}
      :error -> {:error, :invalid_emoji}
    end
  end

  defp validate_image(_image, _content_type), do: {:error, :invalid_emoji}
end
