defmodule Chat.AdminTest do
  use Chat.DataCase, async: true

  alias Chat.Accounts
  alias Chat.Admin
  alias Chat.Feedback
  alias Chat.Security.Subject

  test "only administrators can read feedback" do
    assert {:ok, admin} =
             Accounts.register_user(%{"nickname" => "feedback_admin", "password" => "secret123"})

    assert {:ok, member} =
             Accounts.register_user(%{"nickname" => "feedback_member", "password" => "secret123"})

    assert {:ok, entry} =
             Feedback.submit(
               nil,
               %{"name" => "Гость", "body" => "Добавьте тёмную тему для профилей"},
               Subject.internal(:admin_feedback)
             )

    assert {:ok, [listed_entry]} = Admin.list_feedback(admin)
    assert listed_entry.id == entry.id
    assert listed_entry.user == nil
    assert {:error, :forbidden} = Admin.list_feedback(member)
    assert {:error, :forbidden} = Admin.list_feedback(nil)
  end
end
