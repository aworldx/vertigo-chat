# Назначение файла: Ecto-схема одной сессии присутствия чатланина.
defmodule Chat.Visits.Visit do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "visits" do
    field :nickname, :string
    field :identity_key, :string
    field :session_id, :string
    field :entered_at, :utc_datetime
    field :left_at, :utc_datetime

    belongs_to :user, User

    timestamps(type: :utc_datetime)
  end

  def entrance_changeset(visit, attrs) do
    visit
    |> cast(attrs, [:nickname, :identity_key, :session_id, :entered_at])
    |> validate_required([:nickname, :identity_key, :entered_at])
    |> validate_length(:nickname, min: 3, max: 24)
    |> unique_constraint(:identity_key, name: :visits_active_identity_key_index)
    |> unique_constraint(:session_id, name: :visits_active_session_id_index)
  end

  def exit_changeset(visit, left_at) do
    change(visit, left_at: left_at)
  end
end
