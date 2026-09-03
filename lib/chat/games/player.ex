# Назначение файла: Ecto-схема участника общей партии.
defmodule Chat.Games.Player do
  use Ecto.Schema
  import Ecto.Changeset

  alias Chat.Accounts.User
  alias Chat.Games.Game

  schema "game_players" do
    field :position, :integer
    field :score, :integer, default: 0
    belongs_to :game, Game
    belongs_to :user, User
    timestamps(type: :utc_datetime)
  end

  def changeset(player, attrs) do
    player
    |> cast(attrs, [:position, :score])
    |> validate_required([:position, :score])
    |> validate_number(:position, greater_than: 0)
    |> validate_number(:score, greater_than_or_equal_to: 0)
    |> unique_constraint(:user_id, name: :game_players_game_id_user_id_index)
    |> unique_constraint(:position, name: :game_players_game_id_position_index)
  end
end
