defmodule Chat.Karmik.BatchTest do
  use Chat.DataCase, async: false

  alias Chat.Accounts
  alias Chat.Bot.{DailyUsage, Usage}
  alias Chat.Karmik

  defmodule Provider do
    def assess_batch(input) do
      send(self(), {:batch_input, input})

      {:ok,
       %{
         assessments: Process.get(:batch_assessments, []),
         usage: %{input_tokens: 10, output_tokens: 5, total_tokens: 15}
       }}
    end
  end

  setup do
    {:ok, alice} =
      Accounts.register_user(%{"nickname" => "batch_alice", "password" => "secret123"})

    {:ok, bob} = Accounts.register_user(%{"nickname" => "batch_bob", "password" => "secret123"})
    %{alice: alice, bob: bob}
  end

  test "reviews a conversation once and attributes each assessment to its actual author", %{
    alice: alice,
    bob: bob
  } do
    messages = [
      message(101, alice, "Ты идиот"),
      message(102, bob, "Не обижай меня"),
      message(103, alice, "И ещё раз: идиот")
    ]

    Process.put(:batch_assessments, [assessment(103, :bad), assessment(102, :neutral)])

    assert {:ok, [{:ok, updated}, {:ok, :neutral}]} =
             Karmik.review_batch(Enum.reverse(messages), Provider)

    assert updated.id == alice.id
    assert updated.karma == -1
    assert Accounts.get_user(bob.id).karma == 0
    assert_receive {:batch_input, %{messages: sent, eligible_message_ids: [101, 102, 103]}}
    assert Enum.map(sent, & &1.id) == [101, 102, 103]
    refute_receive {:batch_input, _}
    assert Repo.get_by!(DailyUsage, usage_date: Usage.usage_date()).request_count == 1
    assert Usage.current_total() == 15
    assert [%{room_message_id: 103, delta: -1}] = Karmik.list_recent_assessments()
  end

  test "rejects multiple verdicts for one author before changing any karma", %{alice: alice} do
    Process.put(:batch_assessments, [assessment(201, :bad), assessment(202, :bad)])

    assert {:error, :invalid_assessment} =
             Karmik.review_batch([message(201, alice), message(202, alice)], Provider)

    assert Accounts.get_user(alice.id).karma == 0
    assert Karmik.list_recent_assessments() == []
  end

  test "rejects verdicts for unknown or ineligible messages before applying valid ones", %{
    alice: alice
  } do
    for id <- [999, 302] do
      Process.put(:batch_assessments, [assessment(301, :bad), assessment(id, :bad)])
      guest = %{id: 302, kind: :text, author: "unregistered_guest", body: "Ответ гостя"}

      assert {:error, :invalid_assessment} =
               Karmik.review_batch([message(301, alice), guest], Provider)

      assert Accounts.get_user(alice.id).karma == 0
    end
  end

  test "keeps the latest twelve consecutive messages including neutral replies", %{alice: alice} do
    messages =
      Enum.map(1..15, &message(&1, alice, if(&1 == 1, do: "идиот", else: "Реплика #{&1}")))

    assert {:ok, []} = Karmik.review_batch(Enum.reverse(messages), Provider)
    assert_receive {:batch_input, %{messages: sent}}
    assert Enum.map(sent, & &1.id) == Enum.to_list(4..15)
    assert Accounts.get_user(alice.id).karma == 0
  end

  test "does not reapply an assessment or exceed the daily limit", %{alice: alice} do
    for id <- [401, 402] do
      Process.put(:batch_assessments, [assessment(id, :bad)])
      assert {:ok, [{:ok, _}]} = Karmik.review_batch([message(id, alice)], Provider)
      assert_receive {:batch_input, _}
      assert {:ok, []} = Karmik.review_batch([message(id, alice)], Provider)
      refute_receive {:batch_input, _}
    end

    assert {:ok, []} = Karmik.review_batch([message(403, alice)], Provider)
    refute_receive {:batch_input, _}
    assert Accounts.get_user(alice.id).karma == -2
  end

  test "does not request a batch after exhausting the shared budget", %{alice: alice} do
    previous = Application.get_env(:chat, Usage)
    Application.put_env(:chat, Usage, daily_token_limit: 10, warning_percent: 100)
    on_exit(fn -> Application.put_env(:chat, Usage, previous) end)
    assert {:ok, _} = Usage.record(%{input_tokens: 10, output_tokens: 0, total_tokens: 10})

    assert {:error, :daily_token_limit_reached} =
             Karmik.review_batch([message(501, alice)], Provider)

    refute_receive {:batch_input, _}
  end

  defp message(id, user, body \\ "Реплика"),
    do: %{id: id, kind: :text, author: user.nickname, body: body}

  defp assessment(id, verdict),
    do: %{message_id: id, verdict: verdict, reason: "Оценка разговора."}
end
