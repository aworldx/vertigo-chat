# Назначение файла: тесты ежедневного и праздничного настроения Хичкока.
defmodule Chat.Bot.MoodTest do
  use ExUnit.Case, async: true

  alias Chat.Bot.Mood

  test "holiday mood is always good" do
    instruction = Mood.instruction(~D[2026-01-01])

    assert instruction =~ "неизменно хорошее настроение"
    assert instruction =~ "Не ссылайся сегодня на лень"
  end

  test "ordinary mood is stable for the whole date" do
    assert Mood.instruction(~D[2026-01-10]) == Mood.instruction(~D[2026-01-10])
    assert Mood.instruction(~D[2026-01-10]) =~ "немного лень"
    assert Mood.instruction(~D[2026-01-15]) =~ "не в лучшем настроении"
    assert Mood.instruction(~D[2026-01-11]) =~ "обычное спокойное настроение"
  end
end
