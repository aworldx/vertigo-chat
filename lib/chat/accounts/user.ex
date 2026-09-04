# Назначение файла: Ecto-схема зарегистрированного пользователя чата и валидации его учетных данных.
defmodule Chat.Accounts.User do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.Password
  alias Chat.Checkers.Game
  alias Chat.Library.Article
  alias Chat.Profiles.Profile

  schema "registered_users" do
    field(:nickname, :string)
    field(:password_hash, :string)
    field(:password, :string, virtual: true)
    field(:theme_id, :string, default: "vertigo")
    field(:appearance, :map, default: %{})
    field(:font_id, :string, default: "theme")
    field(:font_style, :string, default: "normal")
    field(:message_sound_enabled, :boolean, default: false)
    field(:public_message_count, :integer, default: 0)
    field(:chat_seconds, :integer, default: 0)
    has_one(:profile, Profile)
    has_many(:library_articles, Article)
    has_many(:sent_checkers_games, Game, foreign_key: :inviter_id)
    has_many(:received_checkers_games, Game, foreign_key: :opponent_id)

    timestamps(type: :utc_datetime)
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:nickname, :password])
    |> validate_required([:nickname, :password])
    |> validate_format(:nickname, ~r/\A[\p{L}\p{N}_-]{3,24}\z/u)
    |> validate_length(:password, min: 6, max: 128)
    |> unique_constraint(:nickname)
    |> put_password_hash()
  end

  def preferences_changeset(user, attrs) do
    user
    |> cast(attrs, [:theme_id, :appearance, :font_id, :font_style, :message_sound_enabled])
    |> validate_required([:theme_id, :appearance, :font_id, :font_style, :message_sound_enabled])
  end

  defp put_password_hash(changeset) do
    case get_change(changeset, :password) do
      nil -> changeset
      password -> put_change(changeset, :password_hash, Password.hash(password))
    end
  end
end
