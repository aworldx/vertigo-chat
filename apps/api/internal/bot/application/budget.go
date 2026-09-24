package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"time"
)

type Budget = domain.Budget
type BudgetStore interface {
	ReadBudget(context.Context, time.Time) (domain.Budget, error)
}
type BudgetReader struct{ store BudgetStore }

func NewBudgetReader(store BudgetStore) BudgetReader { return BudgetReader{store: store} }
func (r BudgetReader) Read(ctx context.Context, now time.Time) (Budget, error) {
	return r.store.ReadBudget(ctx, now)
}
