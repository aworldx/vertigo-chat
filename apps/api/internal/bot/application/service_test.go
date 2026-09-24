package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"strings"
	"testing"
)

type providerFunc func(context.Context, domain.Context) (domain.Result, error)

func (f providerFunc) Generate(ctx context.Context, input domain.Context) (domain.Result, error) {
	return f(ctx, input)
}

type exchangeFunc func(context.Context, domain.Request, func(domain.Context) (domain.Result, error), func(domain.Result) error) (domain.Result, error)

func (f exchangeFunc) Exchange(ctx context.Context, r domain.Request, generate func(domain.Context) (domain.Result, error), publish func(domain.Result) error) (domain.Result, error) {
	return f(ctx, r, generate, publish)
}
func TestAnswerValidatesAndHandlesEmptyProviderResponse(t *testing.T) {
	for _, tc := range []struct {
		name, body    string
		summary       bool
		providerError error
		wantError     bool
		fallback      bool
	}{
		{"answer", " Hello ", false, nil, false, false}, {"empty input", " ", false, nil, true, false}, {"long input", strings.Repeat("я", 1001), false, nil, true, false},
		{"empty response", "Hello", false, domain.ErrEmptyResponse, false, true}, {"empty summary", "Hello", true, domain.ErrEmptyResponse, true, false},
		{"upstream error", "Hello", false, domain.ErrUnavailable, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			published := 0
			calls := 0
			store := exchangeFunc(func(_ context.Context, r domain.Request, generate func(domain.Context) (domain.Result, error), publish func(domain.Result) error) (domain.Result, error) {
				calls++
				if r.Body != "Hello" || r.Identity != "user:1" {
					t.Fatal(r)
				}
				result, err := generate(domain.Context{Summarize: tc.summary})
				if err == nil {
					err = publish(result)
				}
				return result, err
			})
			provider := providerFunc(func(context.Context, domain.Context) (domain.Result, error) {
				return domain.Result{Text: "Reply", Total: 10}, tc.providerError
			})
			result, err := NewService(store, provider).Answer(context.Background(), Request{Body: tc.body, Identity: "user:1"}, func(result domain.Result) error {
				published++
				if result.Text == "" {
					t.Fatal("empty reply published")
				}
				return nil
			})
			if (err != nil) != tc.wantError || result.Fallback != tc.fallback {
				t.Fatal(result, err)
			}
			if !tc.wantError && published != 1 {
				t.Fatal("reply not published")
			}
			if (tc.name == "empty input" || tc.name == "long input") && calls != 0 {
				t.Fatal("invalid input reached store")
			}
		})
	}
}
func TestAnswerPropagatesPublicationFailure(t *testing.T) {
	failed := errors.New("room unavailable")
	store := exchangeFunc(func(_ context.Context, _ domain.Request, _ func(domain.Context) (domain.Result, error), publish func(domain.Result) error) (domain.Result, error) {
		return domain.Result{}, publish(domain.Result{Text: "Reply"})
	})
	_, err := NewService(store, nil).Answer(context.Background(), Request{Body: "Hello"}, func(domain.Result) error { return failed })
	if !errors.Is(err, failed) {
		t.Fatal(err)
	}
}
