# Назначение файла: тесты личных разговоров, раздельной памяти и образа чат-бота Хичкок.
defmodule Chat.BotTest do
  use Chat.DataCase

  alias Chat.Accounts
  alias Chat.Bot
  alias Chat.Bot.Conversation
  alias Chat.Bot.DailyUsage
  alias Chat.Bot.Message
  alias Chat.Bot.Status
  alias Chat.Bot.TestProvider
  alias Chat.Bot.Usage
  alias Chat.Messages
  alias Chat.Security.Subject

  defmodule RateLimitedProvider do
    @behaviour Chat.Bot.Provider

    @impl true
    def generate(_instructions, _messages, _opts),
      do: {:error, {:rate_limited, 1_000}}

    @impl true
    def summarize(_summary, _messages, _opts), do: {:error, :not_called}
  end

  defmodule CapturingProvider do
    @behaviour Chat.Bot.Provider

    @impl true
    def generate(instructions, _messages, opts) do
      send(self(), {:bot_generation, instructions, opts})

      {:ok,
       %Chat.Bot.Provider.Result{
         text: "Саспенс любит краткость.",
         usage: %{input_tokens: 20, output_tokens: 5, total_tokens: 25}
       }}
    end

    @impl true
    def summarize(_summary, _messages, _opts), do: {:error, :not_called}
  end

  defmodule EmptyResponseProvider do
    @behaviour Chat.Bot.Provider

    @impl true
    def generate(_instructions, _messages, _opts), do: {:error, :empty_response}

    @impl true
    def summarize(_summary, _messages, _opts), do: {:error, :not_called}
  end

  test "asks the provider for brief, lively replies that continue the conversation" do
    subject = Subject.guest("203.0.113.50", :short_answer_connection)

    assert {:ok, request} =
             Bot.ask(
               "brief_guest",
               nil,
               subject,
               "Расскажите всю историю кино",
               CapturingProvider
             )

    assert {:ok, _answer} = Bot.answer(request, CapturingProvider)

    assert_receive {:bot_generation, instructions, opts}
    assert instructions =~ "одно-три коротких предложения"
    assert instructions =~ "тебя ждут съёмка, монтажная или продюсер"
    assert instructions =~ "обычные человеческие разговоры"
    assert instructions =~ "не притягивая к ним кино"
    assert instructions =~ "Не своди кино автоматически к саспенсу"
    assert instructions =~ "бодр, дерзок и наблюдателен"
    assert instructions =~ "чаще всего задай один живой встречный вопрос"
    assert instructions =~ "вопрос был бы дежурным"
    assert opts[:max_output_tokens] == 240
  end

  test "runs a reply under the dedicated supervisor" do
    subject = Subject.guest("203.0.113.51", :background_answer_connection)

    assert {:ok, request} =
             Bot.ask("background_guest", nil, subject, "Что посмотреть вечером?", TestProvider)

    task = Bot.answer_async(request, TestProvider)
    assert {:ok, %{author: "Хичкок"}} = Task.await(task)
  end

  test "publishes a fallback instead of silently dropping an empty provider response" do
    subject = Subject.guest("203.0.113.52", :empty_response_connection)

    assert {:ok, request} =
             Bot.ask("fallback_guest", nil, subject, "Вы здесь?", EmptyResponseProvider)

    assert {:ok, answer} = Bot.answer(request, EmptyResponseProvider)
    assert answer.author == "Хичкок"
    assert answer.body =~ "застряла в монтажной"

    assert [:user, :assistant] ==
             Message
             |> where([message], message.conversation_id == ^request.conversation_id)
             |> order_by([message], asc: message.id)
             |> select([message], message.role)
             |> Repo.all()
  end

  test "chooses a reply delay inside the configured range" do
    previous_config = Application.get_env(:chat, Bot)
    Application.put_env(:chat, Bot, reply_delay_range_ms: {5_000, 15_000})
    on_exit(fn -> Application.put_env(:chat, Bot, previous_config) end)

    assert Enum.all?(1..100, fn _attempt -> Bot.reply_delay_ms() in 5_000..15_000 end)
  end

  test "stores a registered chatlan's addressed conversation and reuses its history" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "cinephile", "password" => "secret123"})

    subject = Subject.internal({:registered_bot_test, user.id}) |> Subject.with_actor(user.id)

    assert {:ok, request} =
             Bot.ask(user.nickname, user, subject, "Как создать саспенс?", TestProvider)

    assert request.memory == ""

    assert {:ok, answer} = Bot.answer(request, TestProvider)
    assert answer.kind == :text
    assert answer.author == "Хичкок"
    assert answer.recipient == user.nickname
    assert answer.body =~ "Как создать саспенс?"

    conversation = Repo.get_by!(Conversation, user_id: user.id)
    assert conversation.registered
    assert conversation.exchange_count == 1

    assert [:user, :assistant] ==
             Message
             |> where([message], message.conversation_id == ^conversation.id)
             |> order_by([message], asc: message.id)
             |> select([message], message.role)
             |> Repo.all()

    assert {:ok, next_request} =
             Bot.ask(user.nickname, user, subject, "А монтаж?", TestProvider)

    assert Enum.map(next_request.messages, & &1.role) == [:user, :assistant, :user]
  end

  test "remembers a frequent guest but separates another guest with the same nickname" do
    nickname = "returning_guest"
    first_subject = Subject.guest("203.0.113.10", :first_connection)

    assert {:ok, request} =
             Bot.ask(nickname, nil, first_subject, "Я люблю немое кино", TestProvider)

    conversation = Repo.get!(Conversation, request.conversation_id)

    conversation
    |> Conversation.changeset(%{
      summary: "Собеседник любит немое кино.",
      exchange_count: 3,
      last_interaction_at: DateTime.utc_now()
    })
    |> Repo.update!()

    assert {:ok, remembered_request} =
             Bot.ask(nickname, nil, first_subject, "Вы это помните?", TestProvider)

    assert remembered_request.memory == "Собеседник любит немое кино."

    other_subject = Subject.guest("203.0.113.11", :other_connection)

    assert {:ok, stranger_request} =
             Bot.ask(nickname, nil, other_subject, "А меня?", TestProvider)

    assert stranger_request.memory == ""
    refute stranger_request.conversation_id == conversation.id
  end

  test "refreshes the compact memory periodically without exposing provider failures" do
    subject = Subject.guest("203.0.113.20", :summary_connection)

    assert {:ok, first_request} =
             Bot.ask("film_guest", nil, subject, "Люблю Вёртиго", TestProvider)

    conversation = Repo.get!(Conversation, first_request.conversation_id)

    conversation
    |> Conversation.changeset(%{exchange_count: 5})
    |> Repo.update!()

    assert {:ok, answer} = Bot.answer(first_request, TestProvider)
    assert answer.author == "Хичкок"

    assert Repo.get!(Conversation, conversation.id).summary =~ "Люблю Вёртиго"

    assert %{total_tokens: 150, input_tokens: 120, output_tokens: 30, request_count: 2} =
             Repo.get_by!(DailyUsage, usage_date: Usage.usage_date())
  end

  test "marks Hitchcock as busy when the provider reaches its limit" do
    on_exit(&Status.reset/0)
    subject = Subject.guest("203.0.113.30", :limited_connection)

    assert {:ok, request} =
             Bot.ask("limited_guest", nil, subject, "Вы свободны?", TestProvider)

    assert {:error, :bot_busy} = Bot.answer(request, RateLimitedProvider)
    refute Bot.available?()
    assert Bot.chatlan().busy?

    assert {:error, :bot_busy} =
             Bot.ask("limited_guest", nil, subject, "И всё же?", TestProvider)
  end

  test "counts exact provider usage and leaves for planning near the daily limit" do
    previous_config = Application.get_env(:chat, Usage)

    Application.put_env(:chat, Usage,
      daily_token_limit: 200,
      warning_percent: 90,
      utc_offset_minutes: 180
    )

    on_exit(fn ->
      Application.put_env(:chat, Usage, previous_config)
      Status.reset()
    end)

    Status.reset()
    subject = Subject.guest("203.0.113.40", :daily_budget_connection)

    assert {:ok, first_request} =
             Bot.ask("budget_guest", nil, subject, "Первый вопрос", TestProvider)

    assert {:ok, _answer} = Bot.answer(first_request, TestProvider)
    assert Bot.available?()

    Messages.subscribe("lobby")

    assert {:ok, second_request} =
             Bot.ask("budget_guest", nil, subject, "Второй вопрос", TestProvider)

    assert {:ok, _answer} = Bot.answer(second_request, TestProvider)

    assert_receive {:message_created, %{author: "Хичкок", body: addressed_answer}}
    assert addressed_answer =~ "Второй вопрос"

    assert_receive {:message_created, %{author: "Хичкок", body: planning_message}}
    assert planning_message =~ "ухожу на планёрку"

    refute Bot.available?()

    assert %{total_tokens: 200, input_tokens: 160, output_tokens: 40, request_count: 2} =
             Repo.get_by!(DailyUsage, usage_date: Usage.usage_date())

    assert {:error, :bot_busy} =
             Bot.ask("budget_guest", nil, subject, "Третий вопрос", TestProvider)
  end

  test "uses the configured local day for the daily budget" do
    previous_config = Application.get_env(:chat, Usage)
    Application.put_env(:chat, Usage, utc_offset_minutes: 180)
    on_exit(fn -> Application.put_env(:chat, Usage, previous_config) end)

    now = ~U[2026-01-01 21:30:00Z]

    assert Usage.usage_date(now) == ~D[2026-01-02]
    assert Usage.milliseconds_until_reset(now) == 84_600_000
  end
end
