# Назначение файла: детерминированный тестовый провайдер ответов Хичкока без внешних HTTP-запросов.
defmodule Chat.Bot.TestProvider do
  @behaviour Chat.Bot.Provider

  alias Chat.Bot.Provider.Result

  @impl true
  def generate(_instructions, messages, _opts) do
    question = messages |> List.last() |> Map.fetch!(:body)

    {:ok,
     %Result{
       text: "Разумеется. Даже саспенс дешевле пересъёмки: #{question}",
       usage: %{input_tokens: 80, output_tokens: 20, total_tokens: 100}
     }}
  end

  @impl true
  def summarize(_previous_summary, messages, _opts) do
    questions =
      messages
      |> Enum.filter(&(&1.role == :user))
      |> Enum.map_join("; ", & &1.body)

    {:ok,
     %Result{
       text: "Собеседник прежде спрашивал: #{questions}",
       usage: %{input_tokens: 40, output_tokens: 10, total_tokens: 50}
     }}
  end
end
