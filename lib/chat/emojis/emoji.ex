defmodule Chat.Emojis.Emoji do
  use Ecto.Schema

  import Ecto.Changeset

  schema "emojis" do
    field :code, :string
    field :image, :binary
    field :content_type, :string

    timestamps(type: :utc_datetime)
  end

  def create_changeset(emoji, code, image, content_type) do
    emoji
    |> cast(%{"code" => code}, [:code])
    |> update_change(:code, &String.trim/1)
    |> validate_required([:code])
    |> validate_length(:code, max: 32)
    |> validate_format(:code, ~r/^\S+$/, message: "не должен содержать пробелы")
    |> unique_constraint(:code)
    |> change(image: image, content_type: content_type)
    |> validate_required([:image, :content_type])
  end
end
