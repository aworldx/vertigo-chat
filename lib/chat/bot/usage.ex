# Назначение файла: атомарный учёт токенов OpenAI и правила суточного бюджета Хичкока.
defmodule Chat.Bot.Usage do
  @moduledoc "Сохраняет фактический usage Responses API и определяет суточный лимит."

  alias Chat.Bot.DailyUsage
  alias Chat.Repo

  @default_warning_percent 90
  @default_utc_offset_minutes 180

  def record(%{input_tokens: input, output_tokens: output, total_tokens: total})
      when is_integer(input) and input >= 0 and is_integer(output) and output >= 0 and
             is_integer(total) and total >= 0 do
    attrs = %{
      usage_date: usage_date(),
      input_tokens: input,
      output_tokens: output,
      total_tokens: total,
      request_count: 1
    }

    changeset = DailyUsage.changeset(%DailyUsage{}, attrs)

    case Repo.insert(changeset,
           on_conflict: [
             inc: [
               input_tokens: input,
               output_tokens: output,
               total_tokens: total,
               request_count: 1
             ],
             set: [updated_at: DateTime.utc_now()]
           ],
           conflict_target: :usage_date,
           returning: true
         ) do
      {:ok, usage} ->
        previous_total = usage.total_tokens - total

        {:ok,
         %{
           usage: usage,
           limit: daily_limit(),
           crossed?: crossed?(previous_total, usage.total_tokens),
           reached?: reached?(usage.total_tokens)
         }}

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def record(_usage), do: {:error, :invalid_usage}

  def available? do
    case daily_limit() do
      nil -> true
      _limit -> current_total() < threshold()
    end
  end

  def current_total do
    case Repo.get_by(DailyUsage, usage_date: usage_date()) do
      nil -> 0
      usage -> usage.total_tokens
    end
  end

  def daily_limit do
    :chat
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:daily_token_limit)
    |> positive_integer()
  end

  def warning_percent do
    percent =
      :chat
      |> Application.get_env(__MODULE__, [])
      |> Keyword.get(:warning_percent, @default_warning_percent)

    case positive_integer(percent) do
      nil -> @default_warning_percent
      value -> min(value, 100)
    end
  end

  def usage_date(now \\ DateTime.utc_now()) do
    now
    |> DateTime.add(utc_offset_minutes() * 60, :second)
    |> DateTime.to_date()
  end

  def milliseconds_until_reset(now \\ DateTime.utc_now()) do
    local_now = DateTime.add(now, utc_offset_minutes() * 60, :second)
    next_date = local_now |> DateTime.to_date() |> Date.add(1)
    next_midnight = DateTime.new!(next_date, ~T[00:00:00], "Etc/UTC")
    max(DateTime.diff(next_midnight, local_now, :millisecond), 1_000)
  end

  defp reached?(total) do
    case daily_limit() do
      nil -> false
      _limit -> total >= threshold()
    end
  end

  defp crossed?(previous_total, total) do
    case daily_limit() do
      nil -> false
      _limit -> previous_total < threshold() and total >= threshold()
    end
  end

  defp threshold do
    case daily_limit() do
      nil -> nil
      limit -> ceil(limit * warning_percent() / 100)
    end
  end

  defp utc_offset_minutes do
    :chat
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:utc_offset_minutes, @default_utc_offset_minutes)
  end

  defp positive_integer(value) when is_integer(value) and value > 0, do: value
  defp positive_integer(_value), do: nil
end
