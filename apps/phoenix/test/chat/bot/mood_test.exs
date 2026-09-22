# Назначение файла: тесты ежедневного и праздничного настроения Хичкока.
defmodule Chat.Bot.MoodTest do
  use ExUnit.Case, async: true

  alias Chat.Bot.Mood

  test "holiday mood is especially playful" do
    instruction = Mood.instruction(~D[2026-01-01])

    assert instruction =~ "особенно игрив"
    assert instruction =~ "встречные вопросы"
  end

  test "ordinary mood is stable and upbeat for the whole date" do
    assert Mood.instruction(~D[2026-01-10]) == Mood.instruction(~D[2026-01-10])
    assert Mood.instruction(~D[2026-01-10]) =~ "в отличном настроении"
    assert Mood.instruction(~D[2026-01-15]) =~ "в отличном настроении"
    assert Mood.instruction(~D[2026-01-11]) =~ "Любопытствуй о собеседнике"
  end
end
