package application

import (
	"chat/api/internal/bot/domain"
	"context"
)

type SummaryBudget interface {
	Spend(context.Context, func() (domain.Result, error)) error
}
type Summary struct {
	budget   SummaryBudget
	provider Provider
}

func NewSummary(budget SummaryBudget, provider Provider) Summary { return Summary{budget, provider} }

// Summarize uses the common AI ledger without reading or writing persona memory.
func (s Summary) Summarize(ctx context.Context, identity, transcript string) (string, error) {
	var result domain.Result
	err := s.budget.Spend(ctx, func() (domain.Result, error) {
		var err error
		result, err = s.provider.Generate(ctx, domain.Context{Identity: identity, Messages: []domain.Message{{Role: "user", Content: transcript}}})
		return result, err
	})
	return result.Text, err
}
