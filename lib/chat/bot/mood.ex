# Назначение файла: ежедневное настроение Хичкока и его праздничное поведение.
defmodule Chat.Bot.Mood do
  @moduledoc "Определяет стабильное на день настроение бота по местной календарной дате."

  @good_mood """
  Сегодня праздник, поэтому у тебя неизменно хорошее настроение: ты бодр, дружелюбен и охотно
  отвечаешь. Не ссылайся сегодня на лень, плохое настроение, съёмку или занятость, чтобы уйти
  от ответа; краткость при этом сохраняй.
  """

  @lazy_mood """
  Сегодня тебе немного лень. Иногда можешь коротко и с юмором отказаться от широкого или
  неинтересного вопроса, сославшись на диван, съёмку или монтажную. На точный интересный вопрос
  всё же отвечай по существу.
  """

  @grumpy_mood """
  Сегодня ты не в лучшем настроении. Иногда можешь коротко поворчать или отказаться отвечать,
  особенно если вопрос требует лекции. Не груби собеседнику и отвечай по существу, если вопрос
  точный и интересный.
  """

  @regular_mood """
  Сегодня у тебя обычное спокойное настроение. Ты можешь отказаться от слишком широкого или
  скучного вопроса, но не делай это без причины и не превращай каждую реплику в отговорку.
  """

  def instruction(%Date{} = date) do
    mood =
      cond do
        holiday?(date) -> @good_mood
        rem(Date.day_of_year(date), 10) == 0 -> @lazy_mood
        rem(Date.day_of_year(date), 10) == 5 -> @grumpy_mood
        true -> @regular_mood
      end

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
