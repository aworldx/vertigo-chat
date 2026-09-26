package application

import (
	"chat/api/internal/karmik/domain"
	"context"
	"errors"
	"testing"
)

type reviewStore struct {
	eligible        bool
	err, applyError error
	changes         []int
}

func (s *reviewStore) Eligible(context.Context, int64, int64) (bool, error) { return s.eligible, s.err }
func (s *reviewStore) Apply(_ context.Context, _ Message, _ Assessment, delta int) error {
	s.changes = append(s.changes, delta)
	return s.applyError
}

type assessFunc func(context.Context, domain.Input) ([]Assessment, Usage, error)

func (f assessFunc) Assess(ctx context.Context, in domain.Input) ([]Assessment, Usage, error) {
	return f(ctx, in)
}

type spendFunc func(context.Context, func() (Usage, error)) error

func (f spendFunc) Spend(ctx context.Context, call func() (Usage, error)) error { return f(ctx, call) }
func TestReviewValidatesProviderResultsAndAppliesOnlyEligibleChanges(t *testing.T) {
	failed := errors.New("offline")
	for _, tc := range []struct {
		name, verdict                                      string
		eligible                                           bool
		storeError, applyError, providerError, budgetError error
		invalid                                            bool
		wantError                                          bool
		delta                                              int
	}{
		{name: "good", verdict: "good", eligible: true, delta: 1}, {name: "bad", verdict: "bad", eligible: true, delta: -1}, {name: "neutral", verdict: "neutral", eligible: true},
		{name: "ineligible"}, {name: "store error", storeError: failed, wantError: true}, {name: "provider error", eligible: true, providerError: failed, wantError: true},
		{name: "budget error", eligible: true, budgetError: failed, wantError: true}, {name: "invalid assessment", eligible: true, invalid: true, wantError: true},
		{name: "apply error", verdict: "good", eligible: true, applyError: failed, wantError: true, delta: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &reviewStore{eligible: tc.eligible, err: tc.storeError, applyError: tc.applyError}
			calls := 0
			provider := assessFunc(func(_ context.Context, in domain.Input) ([]Assessment, Usage, error) {
				calls++
				if len(in.EligibleIDs) != 1 || in.EligibleIDs[0] != 1 {
					t.Fatal(in)
				}
				id := int64(1)
				if tc.invalid {
					id = 999
				}
				return []Assessment{{MessageID: id, Verdict: tc.verdict, Reason: "Reason"}}, Usage{Total: 8}, tc.providerError
			})
			budget := spendFunc(func(_ context.Context, call func() (Usage, error)) error {
				if tc.budgetError != nil {
					return tc.budgetError
				}
				usage, err := call()
				if usage.Total != 8 {
					t.Fatal(usage)
				}
				return err
			})
			err := NewService(store, provider, budget).Review(context.Background(), []Message{{ID: 1, UserID: 1, Body: "Открой настройки и выбери шрифт, затем сохрани изменения."}, {ID: 2, UserID: 0}}, nil)
			if (err != nil) != tc.wantError {
				t.Fatal(err)
			}
			if !tc.eligible && calls != 0 {
				t.Fatal("ineligible message sent to provider")
			}
			if tc.delta != 0 {
				if len(store.changes) != 1 || store.changes[0] != tc.delta {
					t.Fatal(store.changes)
				}
			} else if len(store.changes) != 0 {
				t.Fatal(store.changes)
			}
		})
	}
}
func TestReviewBoundsTheBatchToLatestTwelve(t *testing.T) {
	messages := make([]Message, 15)
	for i := range messages {
		messages[i] = Message{ID: int64(i + 1), UserID: int64(i + 1)}
	}
	provider := assessFunc(func(_ context.Context, in domain.Input) ([]Assessment, Usage, error) {
		if len(in.Messages) != 12 || in.Messages[0].ID != 4 || len(in.Context) != 1 {
			t.Fatal(in)
		}
		return nil, Usage{}, nil
	})
	budget := spendFunc(func(_ context.Context, call func() (Usage, error)) error { _, err := call(); return err })
	if err := NewService(&reviewStore{eligible: true}, provider, budget).Review(context.Background(), messages, []Message{{ID: 100}}); err != nil {
		t.Fatal(err)
	}
}

func TestReviewCannotRewardGreetingEvenWhenProviderSaysGood(t *testing.T) {
	for _, tc := range []struct {
		body, verdict string
		changes       int
	}{
		{"Маша, ку", "good", 0}, {"Спасибо за помощь", "good", 0}, {"👍", "good", 0},
		{"Маша, открой Настройки, выбери шрифт и сохрани изменения.", "good", 1},
		{"направленное оскорбление", "bad", 1},
	} {
		t.Run(tc.body, func(t *testing.T) {
			store := &reviewStore{eligible: true}
			provider := assessFunc(func(context.Context, domain.Input) ([]Assessment, Usage, error) {
				return []Assessment{{MessageID: 1, Verdict: tc.verdict, Reason: "Оценка модели"}}, Usage{}, nil
			})
			budget := spendFunc(func(_ context.Context, call func() (Usage, error)) error { _, err := call(); return err })
			if err := NewService(store, provider, budget).Review(context.Background(), []Message{{ID: 1, UserID: 1, Body: tc.body}}, nil); err != nil {
				t.Fatal(err)
			}
			if len(store.changes) != tc.changes {
				t.Fatalf("changes=%v", store.changes)
			}
		})
	}
}
