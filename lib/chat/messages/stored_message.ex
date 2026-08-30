# Назначение файла: Ecto-схема публичного или системного сообщения, сохраняемого в истории комнаты.
defmodule Chat.Messages.StoredMessage do
  use Ecto.Schema

  import Ecto.Changeset

  schema "room_messages" do
    field :room_id, :string
    field :kind, Ecto.Enum, values: [:text, :system]
    field :author, :string
    field :body, :string
    field :recipient, :string
    field :theme_id, :string
    field :appearance, :map, default: %{}
    field :rank, :map
    field :reactions, :map, default: %{}
    field :sent_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [
      :room_id,
      :kind,
      :author,
      :body,
      :recipient,
      :theme_id,
      :appearance,
      :rank,
      :reactions,
      :sent_at
    ])
    |> validate_required([
      :room_id,
      :kind,
      :author,
      :body,
      :theme_id,
      :appearance,
      :reactions,
      :sent_at
    ])
  end
end
