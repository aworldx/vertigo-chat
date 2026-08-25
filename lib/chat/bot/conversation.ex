# Назначение файла: Ecto-схема долговременной памяти Хичкока об одном чатланине.
defmodule Chat.Bot.Conversation do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User
  alias Chat.Bot.Message

  schema "bot_conversations" do
    field :subject_key, :string
    field :nickname, :string
    field :registered, :boolean, default: false
    field :summary, :string, default: ""
    field :exchange_count, :integer, default: 0
    field :last_interaction_at, :utc_datetime_usec
    belongs_to :user, User
    has_many :messages, Message

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [
      :subject_key,
      :nickname,
      :registered,
      :summary,
      :exchange_count,
      :last_interaction_at
    ])
    |> validate_required([:subject_key, :nickname, :registered, :exchange_count])
    |> validate_length(:summary, max: 700)
    |> unique_constraint(:subject_key)
  end
end
