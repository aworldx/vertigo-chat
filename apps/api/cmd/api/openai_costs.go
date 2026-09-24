package main

import (
	"chat/api/internal/observability"
	costsapi "chat/api/internal/openaicosts/adapters/openai"
	costs "chat/api/internal/openaicosts/application"
	"context"
	"log/slog"
	"os"
	"time"
)

func runOpenAICosts(ctx context.Context, metrics *observability.Metrics) {
	key := os.Getenv("OPENAI_COSTS_ADMIN_KEY")
	metrics.ConfigureCosts(key != "")
	if key == "" {
		return
	}
	service := costs.NewService(costsapi.NewClient(key, os.Getenv("OPENAI_COSTS_ORGANIZATION_ID")))
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			readCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
			value, err := service.Read(readCtx, time.Now())
			cancel()
			metrics.RecordCosts(observability.Costs{TodayUSD: value.TodayUSD, MonthUSD: value.MonthUSD, AsOf: value.AsOf}, err)
			if err != nil && ctx.Err() == nil {
				slog.Warn("OpenAI Costs unavailable", "error", err)
			}
			timer.Reset(5 * time.Minute)
		}
	}
}
