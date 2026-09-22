defmodule Chat.FeedbackTest do
  use Chat.DataCase, async: false

  alias Chat.Accounts
  alias Chat.Feedback
  alias Chat.Security.Subject

  test "stores a guest suggestion only when a name is provided" do
    subject = Subject.internal({:guest_feedback, System.unique_integer([:positive])})

    assert {:error, changeset} = Feedback.submit(nil, %{"body" => "Добавьте поиск"}, subject)
    assert "can't be blank" in errors_on(changeset).name

    assert {:ok, entry} =
             Feedback.submit(
               nil,
               %{"name" => "Гость", "body" => "Добавьте поиск по сообщениям"},
               subject
             )

    assert entry.name == "Гость"
    assert entry.user_id == nil
  end

  test "uses the registered chatlan nickname instead of submitted name" do
    assert {:ok, user} =
             Accounts.register_user(%{"nickname" => "feedback_user", "password" => "secret123"})

    subject = Subject.with_actor(Subject.internal(:registered_feedback), user.id)

    assert {:ok, entry} =
             Feedback.submit(
               user,
               %{"name" => "Подмена", "body" => "Добавьте больше тем оформления"},
               subject
             )

    assert entry.name == "feedback_user"
    assert entry.user_id == user.id
  end
end
