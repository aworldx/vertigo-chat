# Назначение файла: тесты киношных званий и учета прогресса зарегистрированных пользователей.
defmodule Chat.RanksTest do
  use Chat.DataCase, async: false

  alias Chat.Accounts
  alias Chat.Messages
  alias Chat.Ranks
  alias Chat.Security.Subject
  alias Chat.Visits

  test "assigns a rank only after both phrase and chat-time milestones are met" do
    {:ok, user} = Accounts.register_user(%{"nickname" => "film_fan", "password" => "secret123"})

    assert %{title: "Зритель первого ряда", icon: "ticket"} = Ranks.for_user(user)

    accomplished = %{
      user
      | public_message_count: 50,
        chat_seconds: 18_000
    }

    assert %{title: "Киноман", icon: "users-group"} = Ranks.for_user(accomplished)

    assert %{title: "Зритель первого ряда"} =
             Ranks.for_user(%{accomplished | chat_seconds: 17_999})
  end

  test "defines ten increasingly demanding ranks with distinct icons" do
    ranks = Ranks.rank_definitions()

    assert length(ranks) == 10
    assert Enum.map(ranks, & &1.icon) == Enum.uniq(Enum.map(ranks, & &1.icon))
    assert Enum.map(ranks, & &1.title) == Enum.uniq(Enum.map(ranks, & &1.title))
    assert List.last(ranks).title == "Режиссер"
    assert Enum.map(ranks, & &1.messages) == Enum.sort(Enum.map(ranks, & &1.messages))
    assert Enum.map(ranks, & &1.hours) == Enum.sort(Enum.map(ranks, & &1.hours))
  end

  test "unlocks library and gallery contributions at their respective ranks" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "unlock_test", "password" => "secret123"})

    refute Ranks.can_add_library_articles?(user)
    refute Ranks.can_add_gallery_photos?(user)

    kinoman = %{user | public_message_count: 50, chat_seconds: 18_000}
    assert Ranks.can_add_library_articles?(kinoman)
    refute Ranks.can_add_gallery_photos?(kinoman)

    statist = %{user | public_message_count: 200, chat_seconds: 72_000}
    assert Ranks.can_add_library_articles?(statist)
    assert Ranks.can_add_gallery_photos?(statist)
  end

  test "counts only successfully delivered registered public messages" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "public_star", "password" => "secret123"})

    subject = Subject.internal({:rank_test, user.id})

    assert {:error, :empty_body} =
             Messages.send_registered_public_message(
               user,
               "rank-room",
               %{"body" => "  "},
               subject
             )

    assert {:ok, message, updated_user} =
             Messages.send_registered_public_message(
               user,
               "rank-room",
               %{"body" => "Мотор!"},
               subject
             )

    assert updated_user.public_message_count == 1
    assert message.rank.title == "Зритель первого ряда"
  end

  test "adds completed registered visit time to the user progress" do
    {:ok, user} =
      Accounts.register_user(%{"nickname" => "night_editor", "password" => "secret123"})

    entered_at = ~U[2026-08-30 10:00:00Z]

    assert {:ok, visit} = Visits.start_visit(user, entered_at)
    assert visit.user_id == user.id

    assert {:ok, _visit} = Visits.finish_visit(visit, DateTime.add(entered_at, 90, :minute))
    assert Accounts.get_user(user.id).chat_seconds == 5_400
  end
end
