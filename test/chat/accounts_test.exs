# Назначение файла: тесты регистрации, хэширования пароля и проверки входа зарегистрированных пользователей.
defmodule Chat.AccountsTest do
  use Chat.DataCase, async: true

  alias Chat.Accounts
  alias Chat.Accounts.User

  test "registers a user with a hashed password" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert user.nickname == "tester"
    assert user.password_hash != "secret123"
    assert user.password_hash =~ "pbkdf2_sha256$"
  end

  test "does not register the same nickname twice" do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert {:error, changeset} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert %{nickname: [_message]} = errors_on(changeset)
  end

  test "authenticates registered users by password" do
    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert {:ok, user} = Accounts.authenticate("tester", "secret123")
    assert user.nickname == "tester"
    assert {:error, :invalid_password} = Accounts.authenticate("tester", "wrong123")
    assert {:error, :not_found} = Accounts.authenticate("unknown", "secret123")
  end

  test "detects registered nicknames" do
    refute Accounts.registered_nickname?("tester")

    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert Accounts.registered_nickname?("tester")
  end

  test "authorizes guest and registered entrances" do
    assert {:ok, nil} = Accounts.authorize_entrance("guest_user", "")

    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "member", "password" => "secret123"})

    assert {:error, :password_required} = Accounts.authorize_entrance("member", "")
    assert {:error, :invalid_password} = Accounts.authorize_entrance("member", "wrong")
    assert {:ok, user} = Accounts.authorize_entrance("member", "secret123")
    assert user.nickname == "member"
    assert {:error, :not_found} = Accounts.authorize_entrance("unknown", "secret123")
  end

  test "rejects invalid authentication input and safely handles unknown ids" do
    assert {:error, :invalid_nickname} = Accounts.authenticate("x", "secret123")
    assert {:error, :missing_password} = Accounts.authenticate("valid_name", nil)
    assert Accounts.get_user("not-an-id") == nil
    refute Accounts.registered_nickname?(nil)
  end

  test "accepts atom registration keys and leaves absent passwords unhashed" do
    assert {:ok, user} = Accounts.register_user(%{nickname: "atom_user", password: "secret123"})
    assert user.nickname == "atom_user"

    changeset = User.registration_changeset(%User{}, %{nickname: "without_password"})
    assert Ecto.Changeset.get_change(changeset, :password_hash) == nil
  end
end
