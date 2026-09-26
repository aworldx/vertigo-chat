package postgres

import (
	"chat/api/internal/bot/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"strconv"
	"strings"
	"time"
)

type Store struct {
	pool          *pgxpool.Pool
	limit, offset int
	warning       int
}

func NewStore(pool *pgxpool.Pool, limit, offset int) Store {
	if offset < -720 || offset > 840 {
		offset = 180
	}
	return Store{pool: pool, limit: limit, offset: offset}
}
func (s Store) Exchange(ctx context.Context, r domain.Request, generate func(domain.Context) (domain.Result, error), publish func(domain.Result) error) (domain.Result, error) {
	var result domain.Result
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return result, err
	}
	defer conn.Release()
	// Only background workers wait here; requests remain in their bounded queue.
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(8420931)`); err != nil {
		return result, err
	}
	defer func() {
		unlock, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlock, `SELECT pg_advisory_unlock(8420931)`)
	}()
	s, err = s.configured(ctx, conn)
	if err != nil {
		return result, err
	}
	date := time.Now().UTC().Add(time.Duration(s.offset) * time.Minute).Format("2006-01-02")
	var conversation int64
	var input domain.Context
	var total int
	conversation, input, total, err = s.prepare(ctx, conn, r, date)
	if err != nil {
		return result, err
	}
	input.Date = date
	result, err = generate(input)
	if err != nil {
		return result, err
	}
	err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		if err := save(ctx, tx, r, conversation, date, result); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO bot_request_receipts(request_id) VALUES($1)`, r.ID)
		return err
	})
	if err != nil {
		return result, err
	}
	// Publish the saved answer before the slower memory refresh, as in legacy.
	if err := publish(result); err != nil {
		return result, err
	}
	if result.Fallback {
		return result, nil
	}
	extra, err := refresh(ctx, conn, conversation, date, r.Identity, total+result.Total < s.threshold() || s.limit <= 0, generate)
	if s.limit > 0 && total+result.Total+extra >= s.threshold() {
		result.PlanningDate = date
	}
	if err != nil {
		slog.Warn("bot summary update failed")
	}
	return result, nil
}

func load(ctx context.Context, tx pgx.Tx, r domain.Request) (int64, domain.Context, error) {
	input := domain.Context{Identity: r.Identity}
	var id int64
	var count int
	var last *time.Time
	registered := strings.HasPrefix(r.Identity, "user:")
	userID, _ := strconv.ParseInt(strings.TrimPrefix(r.Identity, "user:"), 10, 64)
	err := tx.QueryRow(ctx, `INSERT INTO bot_conversations(subject_key,nickname,registered,user_id,summary,exchange_count,inserted_at,updated_at) VALUES($1,$2,$3,NULLIF($4,0),'',0,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') ON CONFLICT(subject_key) DO UPDATE SET nickname=EXCLUDED.nickname RETURNING id,summary,exchange_count,last_interaction_at`, r.Identity, r.Nickname, registered, userID).Scan(&id, &input.Memory, &count, &last)
	if err != nil {
		return 0, input, err
	}
	if !registered && (count < 3 || last == nil || last.Before(time.Now().UTC().AddDate(0, 0, -30))) {
		input.Memory = ""
	}
	rows, err := tx.Query(ctx, `SELECT role,body FROM (SELECT id,role,body FROM bot_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 12) recent ORDER BY id`, id)
	if err != nil {
		return 0, input, err
	}
	defer rows.Close()
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.Role, &m.Content); err != nil {
			return 0, input, err
		}
		input.Messages = append(input.Messages, m)
	}
	input.Messages = append(input.Messages, domain.Message{Role: "user", Content: r.Body})
	return id, input, rows.Err()
}
func save(ctx context.Context, tx pgx.Tx, r domain.Request, id int64, date string, result domain.Result) error {
	if _, err := tx.Exec(ctx, `INSERT INTO bot_messages(conversation_id,role,body,inserted_at) VALUES($1,'user',$2,NOW() AT TIME ZONE 'UTC'),($1,'assistant',$3,NOW() AT TIME ZONE 'UTC')`, id, r.Body, result.Text); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE bot_conversations SET exchange_count=exchange_count+1,last_interaction_at=NOW() AT TIME ZONE 'UTC',updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1`, id); err != nil {
		return err
	}
	if result.Fallback {
		return nil
	}
	return recordUsage(ctx, tx, date, result)
}
func recordUsage(ctx context.Context, tx pgx.Tx, date string, result domain.Result) error {
	if result.Input < 0 || result.Output < 0 || result.Total < 0 {
		return domain.ErrUnavailable
	}
	_, err := tx.Exec(ctx, `INSERT INTO bot_daily_usages(usage_date,input_tokens,output_tokens,total_tokens,request_count,inserted_at,updated_at) VALUES($1,$2,$3,$4,1,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') ON CONFLICT(usage_date) DO UPDATE SET input_tokens=bot_daily_usages.input_tokens+EXCLUDED.input_tokens,output_tokens=bot_daily_usages.output_tokens+EXCLUDED.output_tokens,total_tokens=bot_daily_usages.total_tokens+EXCLUDED.total_tokens,request_count=bot_daily_usages.request_count+1,updated_at=EXCLUDED.updated_at`, date, result.Input, result.Output, result.Total)
	return err
}

func (s Store) prepare(ctx context.Context, conn *pgxpool.Conn, r domain.Request, date string) (int64, domain.Context, int, error) {
	var conversation int64
	var input domain.Context
	var total int
	err := pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		var done bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bot_request_receipts WHERE request_id=$1)`, r.ID).Scan(&done); err != nil {
			return err
		}
		if done {
			return domain.ErrUnavailable
		}
		if err := tx.QueryRow(ctx, `SELECT COALESCE((SELECT total_tokens FROM bot_daily_usages WHERE usage_date=$1),0)`, date).Scan(&total); err != nil {
			return err
		}
		if s.limit > 0 && total >= s.threshold() {
			return domain.ErrUnavailable
		}
		var err error
		conversation, input, err = load(ctx, tx, r)
		return err
	})
	return conversation, input, total, err
}
