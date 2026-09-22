# Назначение файла: хэширование и проверка паролей зарегистрированных пользователей.
defmodule Chat.Accounts.Password do
  @moduledoc """
  Handles password hashing and verification for registered chat users.
  """

  @hash_iterations 210_000
  @salt_bytes 16
  @derived_key_bytes 32
  @hash_algorithm :sha256

  def hash(password) when is_binary(password) do
    salt = :crypto.strong_rand_bytes(@salt_bytes)
    derived_key = derive_key(password, salt, @hash_iterations)

    [
      "pbkdf2_sha256",
      Integer.to_string(@hash_iterations),
      Base.url_encode64(salt, padding: false),
      Base.url_encode64(derived_key, padding: false)
    ]
    |> Enum.join("$")
  end

  def verify(password, password_hash) when is_binary(password) and is_binary(password_hash) do
    with ["pbkdf2_sha256", iterations, salt, expected] <- String.split(password_hash, "$"),
         {iterations, ""} <- Integer.parse(iterations),
         {:ok, salt} <- Base.url_decode64(salt, padding: false),
         {:ok, expected} <- Base.url_decode64(expected, padding: false) do
      password
      |> derive_key(salt, iterations)
      |> secure_compare(expected)
    else
      _invalid_hash -> false
    end
  end

  def verify(_password, _password_hash), do: false

  defp derive_key(password, salt, iterations) do
    :crypto.pbkdf2_hmac(@hash_algorithm, password, salt, iterations, @derived_key_bytes)
  end

  defp secure_compare(left, right) when byte_size(left) == byte_size(right) do
    left
    |> :crypto.exor(right)
    |> :binary.bin_to_list()
    |> Enum.reduce(0, fn byte, acc -> Bitwise.bor(byte, acc) end)
    |> Kernel.==(0)
  end

  defp secure_compare(_left, _right), do: false
end
