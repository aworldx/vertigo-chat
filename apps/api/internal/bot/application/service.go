package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"strings"
	"unicode/utf8"
)

type Request = domain.Request
type Provider interface {
	Generate(context.Context, domain.Context) (domain.Result, error)
}
type Store interface {
	Exchange(context.Context, domain.Request, func(domain.Context) (domain.Result, error), func(domain.Result) error) (domain.Result, error)
}
type Service struct {
	store    Store
	provider Provider
}

func NewService(s Store, p Provider) Service { return Service{s, p} }
func (s Service) Answer(ctx context.Context, r Request, publish func(domain.Result) error) (domain.Result, error) {
	r.Body = strings.TrimSpace(r.Body)
	if r.Body == "" || utf8.RuneCountInString(r.Body) > 1000 {
		return domain.Result{}, domain.ErrUnavailable
	}
	result, err := s.store.Exchange(ctx, r, func(input domain.Context) (domain.Result, error) {
		result, err := s.provider.Generate(ctx, input)
		if errors.Is(err, domain.ErrEmptyResponse) && !input.Summarize {
			return domain.Result{Text: "Моя реплика застряла в монтажной. Сформулируй вопрос ещё раз — и я отвечу без лишней драмы.", Fallback: true}, nil
		}
		return result, err
	}, publish)
	return result, err
}
