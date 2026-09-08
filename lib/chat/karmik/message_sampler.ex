# Назначение файла: локально выбирает одну наиболее значимую реплику из пачки Кармика.
defmodule Chat.Karmik.MessageSampler do
  @moduledoc false

  @harmful_fragments ~w(
    сучк
    ненавиж
    туп
    идиот
    дебил
    мраз
    гандон
    гребан
    урод
    сдохни
  )
  @kind_fragments ~w(спасибо помогу помощь держись прости люблю молодец поддерж)

  def select(messages) when is_list(messages) do
    Enum.max_by(messages, &priority/1, fn -> nil end)
  end

  def priority(message) when is_map(message) do
    body = message |> Map.get(:body, "") |> String.downcase()
    {sentiment_score(body), Map.get(message, :id, 0)}
  end

  defp sentiment_score(body) do
    cond do
      Enum.any?(@harmful_fragments, &String.contains?(body, &1)) -> 2
      Enum.any?(@kind_fragments, &String.contains?(body, &1)) -> 1
      true -> 0
    end
  end
end
