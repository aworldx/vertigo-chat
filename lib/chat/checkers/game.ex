# Назначение файла: Ecto-схема партии в шашки и её участников.
defmodule Chat.Checkers.Game do
  use Ecto.Schema
  import Ecto.Changeset

  alias Chat.Accounts.User

  schema "checkers_games" do
    belongs_to :inviter, User
    belongs_to :opponent, User
    belongs_to :white, User
    belongs_to :winner, User
    field :status, :string, default: "pending"
    field :board, :map, default: %{}
    field :turn, :string, default: "white"
    field :forced_from, :string
    timestamps(type: :utc_datetime)
  end

  def invitation_changeset(game, attrs) do
    game
    |> cast(attrs, [:status, :board, :turn])
    |> validate_required([:status, :board, :turn])
    |> validate_inclusion(:status, ~w(pending active finished declined))
    |> validate_inclusion(:turn, ~w(white black))
    |> assoc_constraint(:inviter)
    |> assoc_constraint(:opponent)
    |> check_constraint(:opponent_id, name: :different_checkers_players)
  end
end
