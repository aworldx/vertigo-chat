# Назначение файла: Ecto-схема публичного или системного сообщения, сохраняемого в истории комнаты.
defmodule Chat.Messages.StoredMessage do
  use Ecto.Schema

  import Ecto.Changeset

  schema "room_messages" do
    field :room_id, :string
    field :kind, Ecto.Enum, values: [:text, :system, :gif, :music]
    field :author, :string
    field :body, :string
    field :client_id, :string
    field :author_identity, :string
    field :media_url, :string
    field :media_artist, :string
    field :media_duration, :string
    field :media_source_url, :string
    field :recipient, :string
    field :theme_id, :string
    field :appearance, :map, default: %{}
    field :font_id, :string, default: "theme"
    field :font_style, :string, default: "normal"
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
      :client_id,
      :author_identity,
      :media_url,
      :media_artist,
      :media_duration,
      :media_source_url,
      :recipient,
      :theme_id,
      :appearance,
      :font_id,
      :font_style,
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
      :font_id,
      :font_style,
      :reactions,
      :sent_at
    ])
    |> validate_length(:client_id, max: 64)
    |> validate_length(:author_identity, max: 255)
    |> unique_constraint(:client_id, name: :room_messages_outbox_id_index)
  end
end
