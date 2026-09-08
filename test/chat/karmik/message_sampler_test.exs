# Назначение файла: тесты выбора одной важной реплики из периодической пачки Кармика.
defmodule Chat.Karmik.MessageSamplerTest do
  use ExUnit.Case, async: true

  alias Chat.Karmik.MessageSampler

  test "prefers an apparent insult over older neutral messages" do
    messages = [
      %{id: 10, body: "привет"},
      %{id: 11, body: "как дела?"},
      %{id: 12, body: "рус, сучка"}
    ]

    assert %{id: 12} = MessageSampler.select(messages)
  end

  test "prefers a clear kind message over neutral chatter" do
    messages = [%{id: 20, body: "обычная реплика"}, %{id: 21, body: "держись, я помогу"}]

    assert %{id: 21} = MessageSampler.select(messages)
  end
end
