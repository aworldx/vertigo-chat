package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"testing"
)

type summaryBudgetFunc func(context.Context, func() (domain.Result, error)) error

func (f summaryBudgetFunc) Spend(ctx context.Context, generate func() (domain.Result, error)) error {
	return f(ctx, generate)
}

type summaryProviderFunc func(context.Context, domain.Context) (domain.Result, error)

func (f summaryProviderFunc) Generate(ctx context.Context, input domain.Context) (domain.Result, error) {
	return f(ctx, input)
}
func TestSummaryUsesBudgetWithoutPersonaMemory(t *testing.T) {
	calls := 0
	provider := summaryProviderFunc(func(_ context.Context, input domain.Context) (domain.Result, error) {
		calls++
		if input.Memory != "" || input.Summarize || input.Identity != "user:1" || len(input.Messages) != 1 || input.Messages[0].Content != "transcript" {
			t.Fatalf("%+v", input)
		}
		return domain.Result{Text: "summary", Total: 12}, nil
	})
	budget := summaryBudgetFunc(func(_ context.Context, generate func() (domain.Result, error)) error {
		result, err := generate()
		if result.Total != 12 {
			t.Fatal(result)
		}
		return err
	})
	text, err := NewSummary(budget, provider).Summarize(context.Background(), "user:1", "transcript")
	if err != nil || text != "summary" || calls != 1 {
		t.Fatal(text, err, calls)
	}
	denied := summaryBudgetFunc(func(context.Context, func() (domain.Result, error)) error { return errors.New("budget") })
	_, err = NewSummary(denied, provider).Summarize(context.Background(), "user:1", "transcript")
	if err == nil || calls != 1 {
		t.Fatal(err, calls)
	}
}
