# Назначение файла: Ecto-схема общей партии для новых игр.
defmodule Chat.Games.Game do
  use Ecto.Schema
  import Ecto.Changeset

  alias Chat.Accounts.User
  alias Chat.Games.Player

  schema "games" do
    field :kind, :string
    field :status, :string, default: "waiting"
    field :state, :map, default: %{}
    belongs_to :creator, User
    belongs_to :winner, User
    has_many :players, Player
    timestamps(type: :utc_datetime)
  end

  def changeset(game, attrs) do
    game
    |> cast(attrs, [:kind, :status, :state, :winner_id])
    |> validate_required([:kind, :status, :state])
    |> validate_inclusion(:kind, ~w(battleship durak balda))
    |> validate_inclusion(:status, ~w(waiting active finished cancelled))
    |> assoc_constraint(:creator)
    |> assoc_constraint(:winner)
  end
end
