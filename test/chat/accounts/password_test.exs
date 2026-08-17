# Назначение файла: тесты хэширования и проверки пароля в отдельном password-модуле.
defmodule Chat.Accounts.PasswordTest do
  use ExUnit.Case, async: true

  alias Chat.Accounts.Password

  test "hashes and verifies passwords" do
    hash = Password.hash("secret123")

    assert hash != "secret123"
    assert hash =~ "pbkdf2_sha256$"
    assert Password.verify("secret123", hash)
    refute Password.verify("wrong123", hash)
  end

  test "rejects invalid password hashes" do
    refute Password.verify("secret123", "not-a-hash")
    refute Password.verify("secret123", nil)
  end
end
