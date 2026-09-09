# Назначение файла: единая точка проверки слов для «Балды» с заменяемым поставщиком словаря.
defmodule Chat.Games.Dictionary do
  @callback valid?(String.t()) :: {:ok, boolean()} | {:error, :unavailable}

  @spec valid?(String.t()) :: {:ok, boolean()} | {:error, :unavailable}
  def valid?(word) when is_binary(word) do
    provider().valid?(word)
  end

  defp provider do
    Application.get_env(:chat, __MODULE__, [])
    |> Keyword.get(:provider, Chat.Games.Wiktionary)
  end
end
