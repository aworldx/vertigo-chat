# Назначение файла: Ecto-схема зарегистрированного пользователя чата и валидации его учетных данных.
defmodule Chat.Accounts.User do
  use Ecto.Schema

  import Ecto.Changeset

  alias Chat.Accounts.Password
  alias Chat.Library.Article
  alias Chat.Profiles.Profile

  schema "registered_users" do
    field(:nickname, :string)
    field(:password_hash, :string)
    field(:password, :string, virtual: true)
    has_one(:profile, Profile)
    has_many(:library_articles, Article)

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

  defp put_password_hash(changeset) do
    case get_change(changeset, :password) do
      nil -> changeset
      password -> put_change(changeset, :password_hash, Password.hash(password))
    end
  end
end
