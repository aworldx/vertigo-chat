# Назначение файла: Ecto-схема одной реплики в личном разговоре чатланина с Хичкоком.
defmodule Chat.Bot.Message do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Bot.Conversation

  schema "bot_messages" do
    field :role, Ecto.Enum, values: [:user, :assistant]
    field :body, :string
    belongs_to :conversation, Conversation

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(message, attrs) do
    message
    |> cast(attrs, [:role, :body])
    |> validate_required([:role, :body])
    |> validate_length(:body, min: 1, max: 4_000)
  end
end
