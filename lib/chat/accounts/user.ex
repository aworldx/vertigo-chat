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
    field(:email, :string)
    field(:password_hash, :string)
    field(:password, :string, virtual: true)
    field(:theme_id, :string, default: "vertigo")
    field(:appearance, :map, default: %{})
    field(:font_id, :string, default: "theme")
    field(:font_style, :string, default: "normal")
    field(:message_sound_enabled, :boolean, default: false)
    field(:is_admin, :boolean, default: false)
    field(:can_moderate_emojis, :boolean, default: false)
    field(:is_game_guest, :boolean, default: false)
    field(:game_nickname, :string)
    field(:guest_identity_id, :binary_id)
    field(:public_message_count, :integer, default: 0)
    field(:chat_seconds, :integer, default: 0)
    field(:karma, :integer, default: 0)
    has_one(:profile, Profile)
    has_many(:library_articles, Article)
    has_many(:sent_checkers_games, Game, foreign_key: :inviter_id)
    has_many(:received_checkers_games, Game, foreign_key: :opponent_id)

    timestamps(type: :utc_datetime)
  end

  def registration_changeset(user, attrs) do
    user
    |> cast(attrs, [:nickname, :password, :email])
    |> validate_required([:nickname, :password])
    |> validate_format(:nickname, ~r/\A[\p{L}\p{N}_-]{3,24}\z/u)
    |> validate_length(:password, min: 6, max: 128)
    |> unique_constraint(:nickname)
    |> validate_email()
    |> put_password_hash()
  end

  def email_changeset(user, attrs) do
    user
    |> cast(attrs, [:email])
    |> validate_required([:email])
    |> validate_email()
  end

  def preferences_changeset(user, attrs) do
    user
    |> cast(attrs, [:theme_id, :appearance, :font_id, :font_style, :message_sound_enabled])
    |> validate_required([:theme_id, :appearance, :font_id, :font_style, :message_sound_enabled])
  end

  def game_guest_changeset(user, attrs) do
    user
    |> cast(attrs, [:nickname, :password_hash, :is_game_guest, :game_nickname, :guest_identity_id])
    |> validate_required([
      :nickname,
      :password_hash,
      :is_game_guest,
      :game_nickname,
      :guest_identity_id
    ])
    |> validate_change(:is_game_guest, fn :is_game_guest, value ->
      if value, do: [], else: [is_game_guest: "must be enabled for a game guest"]
    end)
    |> unique_constraint(:guest_identity_id)
    |> unique_constraint(:nickname)
  end

  defp put_password_hash(changeset) do
    case get_change(changeset, :password) do
      nil -> changeset
      password -> put_change(changeset, :password_hash, Password.hash(password))
    end
  end

  defp validate_email(changeset) do
    changeset
    |> update_change(:email, &normalize_email/1)
    |> validate_format(:email, ~r/\A[^\s@]+@[^\s@]+\.[^\s@]+\z/, allow_blank: true)
    |> unique_constraint(:email, name: :registered_users_lower_email_index)
  end

  defp normalize_email(email) when is_binary(email) do
    case email |> String.trim() |> String.downcase() do
      "" -> nil
      normalized -> normalized
    end
  end

  defp normalize_email(email), do: email
end
