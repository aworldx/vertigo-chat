package application

import (
	"chat/api/internal/rooms/domain"
	"context"
)

type AssessmentHistory interface {
	RecentText(context.Context, int64) ([]domain.Message, error)
	AnnounceAssessment(context.Context, string, int) error
}
type Assessments struct{ store AssessmentHistory }

func NewAssessments(s AssessmentHistory) Assessments { return Assessments{s} }
func (s Assessments) Recent(ctx context.Context, before int64) ([]domain.Message, error) {
	return s.store.RecentText(ctx, before)
}
func (s Assessments) Announce(ctx context.Context, nickname string, delta int) error {
	return s.store.AnnounceAssessment(ctx, nickname, delta)
}
