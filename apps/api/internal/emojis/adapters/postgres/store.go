package postgres

import (
	"chat/api/internal/emojis/domain"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) Store { return Store{pool} }
func (s Store) List(ctx context.Context) ([]domain.Emoji, error) {
	rows, err := s.pool.Query(ctx, `SELECT id,code,COALESCE(width,32),COALESCE(height,32),COALESCE(tags,'{}') FROM emojis WHERE status='approved' ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]domain.Emoji, 0)
	for rows.Next() {
		var e domain.Emoji
		if err := rows.Scan(&e.ID, &e.Code, &e.Width, &e.Height, &e.Terms); err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}
func (s Store) Image(ctx context.Context, id int64) (domain.Image, error) {
	var i domain.Image
	err := s.pool.QueryRow(ctx, `SELECT image,COALESCE(image_key,''),content_type FROM emojis WHERE id=$1 AND status='approved'`, id).Scan(&i.Bytes, &i.Key, &i.ContentType)
	return i, err
}
