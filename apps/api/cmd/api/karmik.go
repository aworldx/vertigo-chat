package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	botpg "chat/api/internal/bot/adapters/postgres"
	botdomain "chat/api/internal/bot/domain"
	karmikapi "chat/api/internal/karmik/adapters/openai"
	karmikpg "chat/api/internal/karmik/adapters/postgres"
	karmik "chat/api/internal/karmik/application"
	"chat/api/internal/observability"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"os"
	"strconv"
	"time"
)

type karmikStore struct{ pool *pgxpool.Pool }

func (s karmikStore) Eligible(ctx context.Context, user, id int64) (bool, error) {
	return karmikpg.NewStore(s.pool).Eligible(ctx, user, id)
}
func (s karmikStore) Apply(ctx context.Context, m karmik.Message, a karmik.Assessment, delta int) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, m.UserID); err != nil {
			return err
		}
		store := karmikpg.NewStore(tx)
		ok, err := store.Eligible(ctx, m.UserID, m.ID)
		if err != nil || !ok {
			return err
		}
		if err := store.Record(ctx, m, a, delta); err != nil {
			return err
		}
		if err := accounts.NewKarma(accountspg.NewAccounts(tx)).Adjust(ctx, m.UserID, delta); err != nil {
			return err
		}
		return rooms.NewAssessments(roompg.NewStore(tx)).Announce(ctx, m.Author, delta)
	})
}

type karmikBudget struct{ store botpg.Store }

func (b karmikBudget) Spend(ctx context.Context, fn func() (karmik.Usage, error)) error {
	return b.store.Spend(ctx, func() (botdomain.Result, error) {
		usage, err := fn()
		return botdomain.Result{Input: usage.Input, Output: usage.Output, Total: usage.Total}, err
	})
}
func runKarmik(ctx context.Context, pool *pgxpool.Pool, metrics *observability.Metrics) {
	limit, _ := strconv.Atoi(env("OPENAI_BOT_DAILY_TOKEN_LIMIT", "120000"))
	offset := botUTCOffset()
	percent, _ := strconv.Atoi(env("OPENAI_BOT_TOKEN_WARNING_PERCENT", "90"))
	provider := karmikapi.NewProvider(
		os.Getenv("OPENAI_API_KEY"),
		env("OPENAI_KARMIK_MODEL", env("OPENAI_BOT_MODEL", "gpt-5.6-terra")),
	)
	provider.Client.Timeout = botTimeout()
	provider.Observe = metrics.OpenAIObserver("karmik")
	provider.ObserveHeaders = metrics.OpenAIHeaders("karmik")
	service := karmik.NewService(karmikStore{pool}, provider, karmikBudget{botpg.NewStore(pool, limit, offset).WithWarningPercent(percent)})
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	var cursor int64
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			review, done := context.WithTimeout(ctx, botTimeout())
			next, err := reviewKarmik(review, pool, service, cursor)
			done()
			if err != nil && ctx.Err() == nil {
				slog.Info("karmik review unavailable", "error", err)
			}
			cursor = next
			timer.Reset(180 * time.Second)
		}
	}
}
func reviewKarmik(ctx context.Context, pool *pgxpool.Pool, service karmik.Service, cursor int64) (int64, error) {
	history := rooms.NewAssessments(roompg.NewStore(pool))
	recent, err := history.Recent(ctx, 0)
	if err != nil {
		return cursor, err
	}
	messages := []karmik.Message{}
	for _, m := range recent {
		if m.ID <= cursor {
			continue
		}
		id, err := accounts.NewKarma(accountspg.NewAccounts(pool)).Find(ctx, m.Author)
		if err != nil {
			return cursor, err
		}
		messages = append(messages, karmik.Message{ID: m.ID, Author: m.Author, Body: m.Body, UserID: id})
	}
	if len(messages) == 0 {
		return cursor, nil
	}
	contextMessages, err := history.Recent(ctx, messages[0].ID)
	if err != nil {
		return cursor, err
	}
	before := []karmik.Message{}
	for _, m := range contextMessages {
		before = append(before, karmik.Message{ID: m.ID, Author: m.Author, Body: m.Body})
	}
	if err := service.Review(ctx, messages, before); err != nil {
		return cursor, err
	}
	return messages[len(messages)-1].ID, nil
}
