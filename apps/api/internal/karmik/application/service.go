package application

import (
	"chat/api/internal/karmik/domain"
	"context"
)

type Message = domain.Message
type Assessment = domain.Assessment
type Usage = domain.Usage
type Provider interface {
	Assess(context.Context, domain.Input) ([]domain.Assessment, domain.Usage, error)
}
type Store interface {
	Eligible(context.Context, int64, int64) (bool, error)
	Apply(context.Context, domain.Message, domain.Assessment, int) error
}
type Budget interface {
	Spend(context.Context, func() (domain.Usage, error)) error
}
type Service struct {
	store    Store
	provider Provider
	budget   Budget
}

func NewService(s Store, p Provider, b Budget) Service { return Service{s, p, b} }
func (s Service) Review(ctx context.Context, messages, history []domain.Message) error {
	if len(messages) > 12 {
		messages = messages[len(messages)-12:]
	}
	eligible := map[int64]domain.Message{}
	input := domain.Input{Messages: messages, Context: history, EligibleIDs: []int64{}}
	for _, m := range messages {
		if m.UserID == 0 {
			continue
		}
		ok, err := s.store.Eligible(ctx, m.UserID, m.ID)
		if err != nil {
			return err
		}
		if ok {
			eligible[m.ID] = m
			input.EligibleIDs = append(input.EligibleIDs, m.ID)
		}
	}
	if len(eligible) == 0 {
		return nil
	}
	var assessments []domain.Assessment
	err := s.budget.Spend(ctx, func() (domain.Usage, error) {
		var usage domain.Usage
		var err error
		assessments, usage, err = s.provider.Assess(ctx, input)
		return usage, err
	})
	if err != nil {
		return err
	}
	if err := domain.Validate(assessments, eligible); err != nil {
		return err
	}
	for _, a := range assessments {
		delta := domain.Delta(a.Verdict)
		if delta != 0 {
			if err := s.store.Apply(ctx, eligible[a.MessageID], a, delta); err != nil {
				return err
			}
		}
	}
	return nil
}
