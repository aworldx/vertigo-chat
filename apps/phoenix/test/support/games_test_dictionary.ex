# Назначение файла: детерминированный словарь для тестов правил «Балды».
defmodule Chat.Games.TestDictionary do
  @behaviour Chat.Games.Dictionary

  @impl true
  def valid?(word), do: {:ok, word in ["САЛ"]}

  @impl true
  def random_five_letter_word, do: {:ok, "САЛАТ"}
end
