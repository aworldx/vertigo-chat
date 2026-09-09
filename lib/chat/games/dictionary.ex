# Назначение файла: единая точка проверки слов для «Балды» с заменяемым поставщиком словаря.
defmodule Chat.Games.Dictionary do
  @callback valid?(String.t()) :: {:ok, boolean()} | {:error, :unavailable}
  @callback random_five_letter_word() :: {:ok, String.t()} | :error

  @spec valid?(String.t()) :: {:ok, boolean()} | {:error, :unavailable}
  def valid?(word) when is_binary(word) do
    provider().valid?(word)
  end

  @spec random_five_letter_word() :: {:ok, String.t()} | :error
  def random_five_letter_word do
    provider().random_five_letter_word()
  end

  defp provider do
    Application.get_env(:chat, __MODULE__, [])
    |> Keyword.get(:provider, Chat.Games.Wiktionary)
  end
end
