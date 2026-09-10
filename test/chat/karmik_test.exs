# Назначение файла: тесты правил Кармика: ясные вердикты и не более двух оценок за день.
defmodule Chat.KarmikTest do
  use Chat.DataCase, async: false

  alias Chat.Accounts
  alias Chat.Bot.Usage
  alias Chat.Karmik
  alias Chat.Karmik.Assessment

  defmodule GoodProvider do
    def assess(_body),
      do: {:ok, %{verdict: :good, reason: "Явная благодарность.", usage: usage()}}

    defp usage, do: %{input_tokens: 4, output_tokens: 1, total_tokens: 5}
  end

  defmodule BadProvider do
    def assess(_body), do: {:ok, %{verdict: :bad, reason: "Явное оскорбление.", usage: usage()}}

    defp usage, do: %{input_tokens: 4, output_tokens: 1, total_tokens: 5}
  end

  defmodule NeutralProvider do
    def assess(_body),
      do: {:ok, %{verdict: :neutral, reason: "Нет ясной оценки.", usage: usage()}}

    defp usage, do: %{input_tokens: 4, output_tokens: 1, total_tokens: 5}
  end

  test "changes karma only for a clear verdict" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "kind_chatlan", "password" => "secret123"})

    assert {:ok, updated_user} =
             Karmik.review(
               %{id: 101, kind: :text, author: user.nickname, body: "Спасибо!"},
               GoodProvider
             )

    assert updated_user.karma == 1

    assert %Assessment{
             chatlan_nickname: "kind_chatlan",
             message_body: "Спасибо!",
             verdict: "good",
             reason: "Явная благодарность.",
             delta: 1
           } = Karmik.list_recent_assessments(1) |> hd()

    assert {:ok, :neutral} =
             Karmik.review(
               %{id: 102, kind: :text, author: user.nickname, body: "Обычная фраза"},
               NeutralProvider
             )

    assert Accounts.get_user(user.id).karma == 1
  end

  test "limits each chatlan to two karma changes a day" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "daily_limit", "password" => "secret123"})

    for id <- 201..202 do
      assert {:ok, _user} =
               Karmik.review(
                 %{id: id, kind: :text, author: user.nickname, body: "хамство"},
                 BadProvider
               )
    end

    assert {:error, :daily_limit_reached} =
             Karmik.review(
               %{id: 203, kind: :text, author: user.nickname, body: "ещё хамство"},
               BadProvider
             )

    assert Accounts.get_user(user.id).karma == -2
  end

  test "does not ask OpenAI after Hitchcock's shared daily token budget is exhausted" do
    previous_config = Application.get_env(:chat, Usage)
    Application.put_env(:chat, Usage, daily_token_limit: 10, warning_percent: 100)
    on_exit(fn -> Application.put_env(:chat, Usage, previous_config) end)

    {:ok, user} =
      Accounts.register_user(%{"nickname" => "shared_budget", "password" => "secret123"})

    assert {:ok, %{reached?: true}} =
             Usage.record(%{input_tokens: 8, output_tokens: 2, total_tokens: 10})

    assert {:error, :daily_token_limit_reached} =
             Karmik.review(
               %{id: 301, kind: :text, author: user.nickname, body: "хамство"},
               BadProvider
             )

    assert Accounts.get_user(user.id).karma == 0
  end
end
