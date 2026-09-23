package postgres

import (
	"chat/api/internal/admin/application"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
	"unicode/utf8"
)

type Reader struct{ pool *pgxpool.Pool }

func NewReader(p *pgxpool.Pool) Reader { return Reader{p} }
func (r Reader) Overview(ctx context.Context, requested string) (application.Overview, error) {
	result := application.Overview{Tables: []string{}, Columns: []string{}, Rows: [][]string{}}
	rows, err := r.pool.Query(ctx, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return result, err
		}
		result.Tables = append(result.Tables, name)
		if name == requested {
			result.Selected = name
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return result, err
	}
	if len(result.Tables) == 0 {
		return result, nil
	}
	if result.Selected == "" {
		result.Selected = result.Tables[0]
	}
	// The identifier comes exclusively from information_schema, never directly from input.
	values, err := r.pool.Query(ctx, `SELECT * FROM `+pgx.Identifier{"public", result.Selected}.Sanitize()+` LIMIT 100`)
	if err != nil {
		return result, err
	}
	defer values.Close()
	for _, field := range values.FieldDescriptions() {
		result.Columns = append(result.Columns, field.Name)
	}
	for values.Next() {
		row, err := values.Values()
		if err != nil {
			return result, err
		}
		text := make([]string, len(row))
		for i, v := range row {
			text[i] = display(v)
		}
		result.Rows = append(result.Rows, text)
	}
	return result, values.Err()
}
func display(v any) string {
	switch value := v.(type) {
	case nil:
		return "nil"
	case string:
		return value
	case []byte:
		if utf8.Valid(value) {
			return string(value)
		}
		return fmt.Sprintf("<binary %d bytes>", len(value))
	case time.Time:
		return value.UTC().Format("2006-01-02 15:04:05")
	case bool:
		if value {
			return "true"
		}
		return "false"
	default:
		b, err := json.Marshal(value)
		if err == nil {
			return string(b)
		}
		return fmt.Sprint(value)
	}
}
