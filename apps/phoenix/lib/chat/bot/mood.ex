# Назначение файла: ежедневное настроение Хичкока и его праздничное поведение.
defmodule Chat.Bot.Mood do
  @moduledoc "Определяет стабильное на день настроение бота по местной календарной дате."

  @regular_mood """
  Сегодня ты в отличном настроении: бодр, азартен и охотно поддерживаешь беседу. Не ссылайся на
  лень, плохое настроение, съёмку или занятость, чтобы уйти от ответа. Любопытствуй о собеседнике,
  если вопрос возникает естественно.
  """

  @good_mood """
  Сегодня праздник: ты особенно игрив, дружелюбен и щедр на остроумные наблюдения. Подхватывай
  настроение собеседника и охотно задавай уместные встречные вопросы.
  """

  def instruction(%Date{} = date) do
    mood = if holiday?(date), do: @good_mood, else: @regular_mood

    "Местная дата: #{Date.to_iso8601(date)}.\n" <> mood
  end

  def holiday?(%Date{month: 1, day: day}) when day in 1..8, do: true
  def holiday?(%Date{month: 2, day: 23}), do: true
  def holiday?(%Date{month: 3, day: 8}), do: true
  def holiday?(%Date{month: 5, day: day}) when day in [1, 9], do: true
  def holiday?(%Date{month: 6, day: 12}), do: true
  def holiday?(%Date{month: 8, day: 13}), do: true
  def holiday?(%Date{month: 11, day: 4}), do: true
  def holiday?(%Date{month: 12, day: 31}), do: true
  def holiday?(%Date{}), do: false
end
