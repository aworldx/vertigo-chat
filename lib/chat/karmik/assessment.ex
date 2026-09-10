# Назначение файла: Ecto-схема вынесенных Кармиком оценок для дневного лимита и аудита.
defmodule Chat.Karmik.Assessment do
  use Ecto.Schema

  import Ecto.Changeset

  schema "karmik_assessments" do
    field :room_message_id, :integer
    field :delta, :integer
    field :assessed_on, :date
    field :chatlan_nickname, :string
    field :message_body, :string
    field :verdict, :string
    field :reason, :string

    belongs_to :user, Chat.Accounts.User

    timestamps(type: :utc_datetime)
  end

  def changeset(assessment, attrs) do
    assessment
    |> cast(attrs, [
      :user_id,
      :room_message_id,
      :delta,
      :assessed_on,
      :chatlan_nickname,
      :message_body,
      :verdict,
      :reason
    ])
    |> validate_required([
      :user_id,
      :room_message_id,
      :delta,
      :assessed_on,
      :chatlan_nickname,
      :message_body,
      :verdict,
      :reason
    ])
    |> validate_inclusion(:delta, [-1, 1])
    |> validate_inclusion(:verdict, ["good", "bad"])
    |> validate_length(:chatlan_nickname, min: 1, max: 24)
    |> validate_length(:message_body, min: 1, max: 1_000)
    |> validate_length(:reason, min: 1, max: 300)
    |> unique_constraint([:user_id, :room_message_id])
  end
end
