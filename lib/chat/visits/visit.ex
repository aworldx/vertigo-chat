# Назначение файла: Ecto-схема одной сессии присутствия чатланина.
defmodule Chat.Visits.Visit do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "visits" do
    field :nickname, :string
    field :entered_at, :utc_datetime
    field :left_at, :utc_datetime

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def entrance_changeset(visit, attrs) do
    visit
    |> cast(attrs, [:nickname, :entered_at, :user_id])
    |> validate_required([:nickname, :entered_at])
    |> validate_length(:nickname, min: 3, max: 24)
  end

  def exit_changeset(visit, left_at) do
    change(visit, left_at: left_at)
  end
end
