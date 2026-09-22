# Назначение файла: контракт провайдера генерации ответов и краткой памяти чат-бота.
defmodule Chat.Bot.Provider do
  defmodule Result do
    @enforce_keys [:text, :usage]
    defstruct [:text, :usage]

    @type t :: %__MODULE__{text: String.t(), usage: map()}
  end

  @callback generate(String.t(), list(map()), keyword()) ::
              {:ok, Result.t()} | {:error, term()}
  @callback summarize(String.t(), list(map()), keyword()) ::
              {:ok, Result.t()} | {:error, term()}
end
