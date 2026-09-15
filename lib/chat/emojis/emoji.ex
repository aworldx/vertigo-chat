defmodule Chat.Emojis.Emoji do
  use Ecto.Schema

  import Ecto.Changeset

  schema "emojis" do
    field :code, :string
    field :image, :binary
    field :image_key, :string
    field :content_type, :string
    field :status, Ecto.Enum, values: [:pending, :approved, :rejected, :hidden], default: :pending
    field :tags, {:array, :string}, default: []
    field :suggestion_terms, {:array, :string}, virtual: true, default: []
    field :width, :integer
    field :height, :integer
    field :animated, :boolean, default: false
    field :rejection_reason, :string
    belongs_to :user, Chat.Accounts.User

    many_to_many :emoji_tags, Chat.Emojis.Tag,
      join_through: "emoji_tag_assignments",
      join_keys: [emoji_id: :id, emoji_tag_id: :id],
      on_replace: :delete

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

  def submission_changeset(emoji, attrs) do
    emoji
    |> cast(attrs, [:code, :image, :content_type, :width, :height, :animated, :user_id])
    |> normalize_code()
    |> validate_required([:code, :content_type, :width, :height, :user_id])
    |> validate_format(:code, ~r/^:[\p{Ll}\p{Nd}_]{2,30}:$/u,
      message: "используйте код вида :кот_плачет:"
    )
    |> unique_constraint(:code)
  end

  def moderation_changeset(emoji, attrs) do
    emoji
    |> cast(attrs, [:code, :status, :tags, :rejection_reason])
    |> normalize_code()
    |> validate_format(:code, ~r/^:[\p{Ll}\p{Nd}_]{2,30}:$/u,
      message: "используйте код вида :кот_плачет:"
    )
    |> unique_constraint(:code)
    |> update_change(:tags, &normalize_tags/1)
    |> validate_required([:status])
    |> validate_length(:rejection_reason, max: 500)
  end

  defp normalize_code(changeset) do
    update_change(changeset, :code, fn code ->
      code
      |> String.trim()
      |> String.trim(":")
      |> String.downcase()
      |> then(&(":" <> &1 <> ":"))
    end)
  end

  defp normalize_tags(tags) when is_list(tags) do
    tags
    |> Enum.map(&(to_string(&1) |> String.trim() |> String.downcase()))
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp normalize_tags(_tags), do: []
end
