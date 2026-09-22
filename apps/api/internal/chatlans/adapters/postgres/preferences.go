package postgres

import (
	"chat/api/internal/chatlans/application"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Database interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db} }
func (s Store) Get(ctx context.Context, identity string) (application.Preferences, error) {
	var raw []byte
	var p application.Preferences
	err := s.db.QueryRow(ctx, `SELECT preferences FROM chatlan_preferences WHERE identity_key=$1`, identity).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil
	}
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(raw, &p)
	return p, err
}
func (s Store) Put(ctx context.Context, identity string, p application.Preferences) error {
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO chatlan_preferences(identity_key,preferences) VALUES($1,$2) ON CONFLICT(identity_key) DO UPDATE SET preferences=$2,updated_at=now()`, identity, raw)
	return err
}
