defmodule Chat.Karmik.OpenAITest do
  use ExUnit.Case, async: false

  alias Chat.Karmik.OpenAI

  setup do
    previous_config = Application.get_env(:chat, OpenAI)

    Application.put_env(:chat, OpenAI,
      api_key: "test-key",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, OpenAI, previous_config) end)
    :ok
  end

  setup {Req.Test, :verify_on_exit!}

  test "decodes per-message assessments from one batch response" do
    input = %{
      messages: [%{id: 10, author: "А", body: "Реплика"}, %{id: 11, author: "Б", body: "Ответ"}],
      eligible_message_ids: [10, 11],
      context: []
    }

    Req.Test.expect(__MODULE__, fn conn ->
      request = conn |> Req.Test.raw_body() |> Jason.decode!()
      assert [%{"role" => "user", "content" => content}] = request["input"]
      assert Jason.decode!(content) == input |> Jason.encode!() |> Jason.decode!()
      assert request["max_output_tokens"] > 96

      Req.Test.json(conn, %{
        "output" => [
          %{
            "content" => [
              %{
                "type" => "output_text",
                "text" =>
                  ~s({"assessments":[{"message_id":10,"verdict":"bad","reason":"Нападки на собеседника."}]})
              }
            ]
          }
        ],
        "usage" => %{"input_tokens" => 100, "output_tokens" => 20, "total_tokens" => 120}
      })
    end)

    assert {:ok, %{assessments: [%{message_id: 10, verdict: :bad}], usage: %{total_tokens: 120}}} =
             OpenAI.assess_batch(input)
  end

  test "rejects malformed batch verdicts" do
    for entry <- [
          %{message_id: "10", verdict: "bad", reason: "Причина"},
          %{message_id: 10, verdict: "unknown", reason: "Причина"}
        ] do
      Req.Test.expect(__MODULE__, fn conn ->
        Req.Test.json(conn, %{
          "output" => [
            %{
              "content" => [
                %{"type" => "output_text", "text" => Jason.encode!(%{assessments: [entry]})}
              ]
            }
          ]
        })
      end)

      assert {:error, :invalid_response} =
               OpenAI.assess_batch(%{messages: [], eligible_message_ids: [], context: []})
    end
  end

  test "sends the target and its conversation as separate data with an unchanged usage contract" do
    input = %{
      message: %{author: "Рассказчица", body: "когда будем жрать, мать?"},
      context: [%{author: "Рассказчица", body: "Мои дети кричат мне:"}]
    }

    Req.Test.expect(__MODULE__, fn conn ->
      request = conn |> Req.Test.raw_body() |> Jason.decode!()
      assert [%{"role" => "user", "content" => content}] = request["input"]
      assert Jason.decode!(content) == input |> Jason.encode!() |> Jason.decode!()
      assert request["store"] == false

      Req.Test.json(conn, %{
        "output" => [
          %{
            "content" => [
              %{
                "type" => "output_text",
                "text" => ~s({"verdict":"neutral","reason":"Пересказ детских слов."})
              }
            ]
          }
        ],
        "usage" => %{"input_tokens" => 123, "output_tokens" => 17, "total_tokens" => 140}
      })
    end)

    assert {:ok,
            %{verdict: :neutral, reason: "Пересказ детских слов.", usage: %{total_tokens: 140}}} =
             OpenAI.assess(input)
  end

  test "does not assess a bare message without author and context" do
    assert {:error, :invalid_message} = OpenAI.assess("когда будем жрать, мать?")
  end
end
