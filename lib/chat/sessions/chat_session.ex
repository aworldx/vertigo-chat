# Назначение файла: устойчивое рабочее состояние одной чат-сессии.
defmodule Chat.Sessions.ChatSession do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Visits.Visit

  @statuses ~w(active reconnecting ended)

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "chat_sessions" do
    field :room_id, :string
    field :identity_key, :string
    field :nickname, :string
    field :resume_secret_hash, :string
    field :status, :string
    field :last_seen_at, :utc_datetime
    field :reconnect_deadline_at, :utc_datetime
    field :ended_at, :utc_datetime
    field :generation, :integer, default: 0

    belongs_to :visit, Visit

    timestamps(type: :utc_datetime)
  end

  def create_changeset(session, attrs) do
    attrs =
      Map.new(attrs, fn
        {key, %DateTime{} = value} -> {key, DateTime.truncate(value, :second)}
        pair -> pair
      end)

    session
    |> change(
      Map.take(attrs, [
        :id,
        :identity_key,
        :resume_secret_hash,
        :status,
        :last_seen_at,
        :reconnect_deadline_at,
        :generation,
        :visit_id
      ])
    )
    |> cast(attrs, [:room_id, :nickname])
    |> validate_required([
      :room_id,
      :identity_key,
      :nickname,
      :resume_secret_hash,
      :status,
      :last_seen_at
    ])
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint(:nickname, name: :chat_sessions_active_room_nickname_index)
    |> unique_constraint(:identity_key, name: :chat_sessions_active_room_identity_index)
  end
end
