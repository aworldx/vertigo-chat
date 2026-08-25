# Назначение файла: Ecto-схема сохраняемого суточного расхода токенов Хичкока.
defmodule Chat.Bot.DailyUsage do
  use Ecto.Schema

  import Ecto.Changeset

  schema "bot_daily_usages" do
    field :usage_date, :date
    field :input_tokens, :integer, default: 0
    field :output_tokens, :integer, default: 0
    field :total_tokens, :integer, default: 0
    field :request_count, :integer, default: 0

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(usage, attrs) do
    usage
    |> cast(attrs, [:usage_date, :input_tokens, :output_tokens, :total_tokens, :request_count])
    |> validate_required([:usage_date])
    |> validate_number(:input_tokens, greater_than_or_equal_to: 0)
    |> validate_number(:output_tokens, greater_than_or_equal_to: 0)
    |> validate_number(:total_tokens, greater_than_or_equal_to: 0)
    |> validate_number(:request_count, greater_than_or_equal_to: 0)
    |> unique_constraint(:usage_date)
  end
end
