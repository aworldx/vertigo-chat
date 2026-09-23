package postgres

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"fmt"
	"time"
)

func (s Store) RecentVisits(ctx context.Context, since time.Time) ([]domain.Visit, error) {
	// Legacy timestamps are UTC timestamp-without-time-zone. Explicit conversion
	// makes the cutoff and output independent of the PostgreSQL session timezone.
	rows, err := s.pool.Query(ctx, `SELECT id,nickname,entered_at AT TIME ZONE 'UTC',left_at AT TIME ZONE 'UTC'
 FROM visits WHERE entered_at >= ($1::timestamptz AT TIME ZONE 'UTC')
 ORDER BY entered_at DESC,id DESC`, since.UTC())
	if err != nil {
		return nil, fmt.Errorf("read visit history: %w", err)
	}
	defer rows.Close()
	result := make([]domain.Visit, 0)
	for rows.Next() {
		var visit domain.Visit
		if err := rows.Scan(&visit.ID, &visit.Nickname, &visit.EnteredAt, &visit.LeftAt); err != nil {
			return nil, fmt.Errorf("scan visit: %w", err)
		}
		result = append(result, visit)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read visits: %w", err)
	}
	return result, nil
}
