# Назначение файла: Ecto-схема вынесенных Кармиком оценок для дневного лимита и аудита.
defmodule Chat.Karmik.Assessment do
  use Ecto.Schema

  import Ecto.Changeset

  schema "karmik_assessments" do
    field :room_message_id, :integer
    field :delta, :integer
    field :assessed_on, :date

    belongs_to :user, Chat.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(assessment, attrs) do
    assessment
    |> cast(attrs, [:user_id, :room_message_id, :delta, :assessed_on])
    |> validate_required([:user_id, :room_message_id, :delta, :assessed_on])
    |> validate_inclusion(:delta, [-1, 1])
    |> unique_constraint([:user_id, :room_message_id])
  end
end
