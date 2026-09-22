// Package migrations applies only schema changes owned by the Go application.
package migrations

import (
	"context"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed *.sql
var files embed.FS

func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(674923001)`); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS go_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
			return err
		}
		entries, err := files.ReadDir(".")
		if err != nil {
			return err
		}
		for _, entry := range entries {
			var applied bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM go_schema_migrations WHERE version=$1)`, entry.Name()).Scan(&applied); err != nil {
				return err
			}
			if applied {
				continue
			}
			sql, err := files.ReadFile(entry.Name())
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				return fmt.Errorf("migration %s: %w", entry.Name(), err)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO go_schema_migrations(version) VALUES ($1)`, entry.Name()); err != nil {
				return err
			}
		}
		return nil
	})
}
