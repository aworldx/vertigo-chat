package application

import (
	"chat/api/internal/openaicosts/domain"
	"context"
	"time"
)

type Costs = domain.Costs
type Source interface {
	Read(context.Context, time.Time, time.Time) ([]domain.Bucket, error)
}
type Service struct{ source Source }

func NewService(source Source) Service { return Service{source: source} }
func (s Service) Read(ctx context.Context, now time.Time) (Costs, error) {
	now = now.UTC()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	buckets, err := s.source.Read(ctx, start, now)
	if err != nil {
		return Costs{}, err
	}
	return domain.Aggregate(buckets, now), nil
}
