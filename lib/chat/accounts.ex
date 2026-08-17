# Назначение файла: контекст регистрации и входа зарегистрированных пользователей чата.
defmodule Chat.Accounts do
  @moduledoc """
  Registers chat users and verifies registered-user passwords.
  """

  import Ecto.Query

  alias Chat.Accounts.Password
  alias Chat.Accounts.User
  alias Chat.Chatlans
  alias Chat.Profiles
  alias Chat.Repo

  def register_user(attrs) do
    nickname = Chatlans.normalize_nickname(attrs["nickname"] || attrs[:nickname], nil)

    attrs =
      attrs
      |> stringify_keys()
      |> Map.put("nickname", nickname)

    Repo.transaction(fn ->
      with {:ok, user} <- %User{} |> User.registration_changeset(attrs) |> Repo.insert(),
           {:ok, _profile} <- Profiles.create_for_user(user) do
        user
      else
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def registered_nickname?(nickname) do
    nickname = Chatlans.normalize_nickname(nickname, nil)

    if nickname do
      Repo.exists?(from(user in User, where: user.nickname == ^nickname))
    else
      false
    end
  end

  def get_user(id) when is_integer(id), do: Repo.get(User, id)
  def get_user(_id), do: nil

  def authenticate(nickname, password) do
    nickname = Chatlans.normalize_nickname(nickname, nil)
    password = normalize_password(password)

    cond do
      is_nil(nickname) -> {:error, :invalid_nickname}
      password == "" -> {:error, :missing_password}
      true -> verify_registered_user(nickname, password)
    end
  end

  def authorize_entrance(nickname, password) do
    password = normalize_password(password)

    cond do
      password != "" -> authenticate(nickname, password)
      registered_nickname?(nickname) -> {:error, :password_required}
      true -> {:ok, nil}
    end
  end

  defp verify_registered_user(nickname, password) do
    user = Repo.get_by(User, nickname: nickname)

    cond do
      is_nil(user) -> {:error, :not_found}
      Password.verify(password, user.password_hash) -> {:ok, user}
      true -> {:error, :invalid_password}
    end
  end

  defp normalize_password(password) when is_binary(password), do: password
  defp normalize_password(_password), do: ""

  defp stringify_keys(attrs) do
    Map.new(attrs, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end
end
