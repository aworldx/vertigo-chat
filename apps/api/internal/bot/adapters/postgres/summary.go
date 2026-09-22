package postgres

import (
	"chat/api/internal/bot/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Summary failure must never discard an already generated reply.
func refresh(ctx context.Context, conn *pgxpool.Conn, id int64, date, identity string, budget bool, generate func(domain.Context) (domain.Result, error)) (int, error) {
	if !budget {
		return 0, nil
	}
	var count int
	input := domain.Context{Identity: identity, Date: date, Summarize: true}
	if err := conn.QueryRow(ctx, `SELECT exchange_count,summary FROM bot_conversations WHERE id=$1`, id).Scan(&count, &input.Memory); err != nil {
		return 0, err
	}
	if count%6 != 0 {
		return 0, nil
	}
	rows, err := conn.Query(ctx, `SELECT role,body FROM (SELECT id,role,body FROM bot_messages WHERE conversation_id=$1 ORDER BY id DESC LIMIT 20) recent ORDER BY id`, id)
	if err != nil {
		return 0, err
	}
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.Role, &m.Content); err != nil {
			rows.Close()
			return 0, err
		}
		input.Messages = append(input.Messages, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}
	summary, err := generate(input)
	if err != nil {
		return 0, nil
	}
	text := []rune(summary.Text)
	if len(text) > 700 {
		text = text[:700]
	}
	err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE bot_conversations SET summary=$2 WHERE id=$1`, id, string(text)); err != nil {
			return err
		}
		return recordUsage(ctx, tx, date, summary)
	})
	return summary.Total, err
}
