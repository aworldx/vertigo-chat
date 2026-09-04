# Назначение файла: тесты регистрации, хэширования пароля и проверки входа зарегистрированных пользователей.
defmodule Chat.AccountsTest do
  use Chat.DataCase, async: true

  alias Chat.Accounts
  alias Chat.Accounts.User
  alias Chat.Security.Subject

  test "registers a user with a hashed password" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert user.nickname == "tester"
    assert user.password_hash != "secret123"
    assert user.password_hash =~ "pbkdf2_sha256$"
  end

  test "assigns the first registered user as an administrator" do
    assert {:ok, first_user} =
             Accounts.register_user(%{"nickname" => "first_admin", "password" => "secret123"})

    assert {:ok, second_user} =
             Accounts.register_user(%{"nickname" => "second_user", "password" => "secret123"})

    assert Accounts.admin?(first_user)
    refute Accounts.admin?(second_user)
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

  test "persists normalized chat preferences" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "styled_user", "password" => "secret123"})

    assert {:ok, user} =
             Accounts.update_preferences(user, %{
               "theme_id" => "night_sky",
               "font_id" => "serif",
               "font_style" => "italic",
               "message_sound_enabled" => "true",
               "appearance" => %{
                 "message_frame" => "false",
                 "dark" => %{"nickname_color" => "#AA44CC", "text_color" => "#22AA88"}
               }
             })

    preferences = Accounts.user_preferences(Accounts.get_user(user.id))

    assert preferences["theme_id"] == "night_sky"
    assert preferences["font_id"] == "serif"
    assert preferences["font_style"] == "italic"
    assert preferences["message_sound_enabled"]
    assert preferences["appearance"]["dark"]["nickname_color"] == "#aa44cc"
    assert preferences["appearance"]["dark"]["text_color"] == "#22aa88"
    refute preferences["appearance"]["message_frame"]
  end

  test "falls back to existing typography preferences for unknown values" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "type_safe", "password" => "secret123"})

    assert {:ok, updated_user} =
             Accounts.update_preferences(user, %{
               "font_id" => "<script>",
               "font_style" => "ultra_bold"
             })

    assert updated_user.font_id == "theme"
    assert updated_user.font_style == "normal"
    refute updated_user.message_sound_enabled
  end

  test "detects registered nicknames" do
    refute Accounts.registered_nickname?("tester")

    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "tester", "password" => "secret123"})

    assert Accounts.registered_nickname?("tester")
  end

  test "authorizes guest and registered entrances" do
    assert {:ok, nil} = Accounts.authorize_entrance("guest_user", "")
    assert {:error, :invalid_nickname} = Accounts.authorize_entrance("", "")
    assert {:error, :invalid_nickname} = Accounts.authorize_entrance(nil, "")

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

  test "prevents repeated registration from the same client identity" do
    subject = unique_subject(:registration_test)

    assert {:ok, _user} =
             Accounts.register_user(
               %{"nickname" => "first_identity", "password" => "secret123"},
               subject
             )

    assert {:error, :rate_limited} =
             Accounts.register_user(
               %{"nickname" => "second_identity", "password" => "secret123"},
               subject
             )
  end

  test "rejects injection-shaped nicknames before querying the database" do
    assert {:error, changeset} =
             Accounts.register_user(%{
               "nickname" => "admin' OR 1=1 --",
               "password" => "secret123"
             })

    assert %{nickname: [_message]} = errors_on(changeset)
  end

  test "does not consume a registration allowance for a database validation error" do
    subject = unique_subject(:retry_registration)

    assert {:ok, _user} =
             Accounts.register_user(%{"nickname" => "already_taken", "password" => "secret123"})

    assert {:error, %Ecto.Changeset{}} =
             Accounts.register_user(
               %{"nickname" => "already_taken", "password" => "secret123"},
               subject
             )

    assert {:ok, _user} =
             Accounts.register_user(
               %{"nickname" => "available_after_retry", "password" => "secret123"},
               subject
             )
  end

  defp unique_subject(prefix) do
    unique = System.unique_integer([:positive])
    Subject.guest("#{prefix}-#{unique}", unique)
  end
end
