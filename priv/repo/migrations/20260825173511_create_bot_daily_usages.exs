defmodule Chat.Repo.Migrations.CreateBotDailyUsages do
  use Ecto.Migration

  def change do
    create table(:bot_daily_usages) do
      add :usage_date, :date, null: false
      add :input_tokens, :bigint, null: false, default: 0
      add :output_tokens, :bigint, null: false, default: 0
      add :total_tokens, :bigint, null: false, default: 0
      add :request_count, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:bot_daily_usages, [:usage_date])
  end
end
