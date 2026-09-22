defmodule Chat.Emojis.Tag do
  use Ecto.Schema

  import Ecto.Changeset

  schema "emoji_tags" do
    field :name, :string
    field :triggers, {:array, :string}, default: []
    field :search_document, Chat.Types.TSVector, read_after_writes: true

    many_to_many :emojis, Chat.Emojis.Emoji,
      join_through: "emoji_tag_assignments",
      join_keys: [emoji_tag_id: :id, emoji_id: :id]

    timestamps(type: :utc_datetime)
  end

  def changeset(tag, attrs) do
    attrs = normalize_trigger_params(attrs)

    tag
    |> cast(attrs, [:name, :triggers])
    |> update_change(:name, &(String.trim(&1) |> String.downcase()))
    |> update_change(:triggers, &normalize_triggers/1)
    |> validate_required([:name])
    |> validate_length(:name, max: 40)
    |> validate_length(:triggers, max: 20)
    |> validate_change(:triggers, fn :triggers, triggers ->
      if Enum.all?(triggers, &(String.length(&1) <= 60)),
        do: [],
        else: [triggers: "слишком длинный"]
    end)
    |> unique_constraint(:name)
  end

  defp normalize_trigger_params(attrs) when is_map(attrs) do
    Map.update(attrs, "triggers", [], fn
      triggers when is_binary(triggers) -> String.split(triggers, ~r/\r\n|\n|\r/u, trim: true)
      triggers -> triggers
    end)
  end

  defp normalize_trigger_params(attrs), do: attrs

  defp normalize_triggers(triggers) when is_list(triggers) do
    triggers
    |> Enum.map(&(to_string(&1) |> String.trim() |> String.downcase()))
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp normalize_triggers(_triggers), do: []
end
