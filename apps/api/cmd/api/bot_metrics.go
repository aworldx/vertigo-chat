package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	"chat/api/internal/observability"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
	"time"
)

func configureBotMetrics(metrics *observability.Metrics, pool *pgxpool.Pool) {
	limit, _ := strconv.Atoi(env("OPENAI_BOT_DAILY_TOKEN_LIMIT", "120000"))
	percent, _ := strconv.Atoi(env("OPENAI_BOT_TOKEN_WARNING_PERCENT", "90"))
	reader := bot.NewBudgetReader(botpg.NewStore(pool, limit, botUTCOffset()).WithWarningPercent(percent))
	metrics.WithBudget(func(ctx context.Context) (observability.Budget, error) {
		budget, err := reader.Read(ctx, time.Now())
		return observability.Budget{Limit: budget.Limit, Used: budget.Used, StopThreshold: budget.StopThreshold, Remaining: budget.Remaining, Available: budget.Available}, err
	})
}
