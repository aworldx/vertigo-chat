# Назначение файла: контрактные тесты разбора текста, usage и лимитов Responses API.
defmodule Chat.Bot.OpenAITest do
  use ExUnit.Case

  alias Chat.Bot.OpenAI
  alias Chat.Bot.Provider.Result

  setup do
    previous_config = Application.get_env(:chat, OpenAI)

    Application.put_env(:chat, OpenAI,
      api_key: "test-key",
      model: "gpt-5.4-nano",
      plug: {Req.Test, __MODULE__},
      retry: false
    )

    on_exit(fn -> Application.put_env(:chat, OpenAI, previous_config) end)
    :ok
  end

  setup {Req.Test, :verify_on_exit!}

  test "returns response text together with exact token usage" do
    Req.Test.expect(__MODULE__, fn conn ->
      assert Plug.Conn.get_req_header(conn, "authorization") == ["Bearer test-key"]

      request = conn |> Req.Test.raw_body() |> Jason.decode!()
      assert request["model"] == "gpt-5.4-nano"
      assert request["store"] == false

      Req.Test.json(conn, %{
        "output" => [
          %{"content" => [%{"type" => "output_text", "text" => "Добрый вечер."}]}
        ],
        "usage" => %{
          "input_tokens" => 123,
          "output_tokens" => 17,
          "total_tokens" => 140
        }
      })
    end)

    assert {:ok,
            %Result{
              text: "Добрый вечер.",
              usage: %{input_tokens: 123, output_tokens: 17, total_tokens: 140}
            }} =
             OpenAI.generate("Инструкция", [%{role: :user, body: "Здравствуйте"}],
               safety_identifier: "visitor"
             )
  end

  test "reports provider rate limiting without a generated result" do
    Req.Test.expect(__MODULE__, fn conn ->
      conn
      |> Plug.Conn.put_status(429)
      |> Req.Test.json(%{"error" => %{"code" => "rate_limit_exceeded"}})
    end)

    assert {:error, {:rate_limited, 60_000}} =
             OpenAI.generate("Инструкция", [%{role: :user, body: "Здравствуйте"}], [])
  end
end
