package application

import (
	"chat/api/internal/mediasearch/domain"
	"context"
	"errors"
	"strings"
	"unicode/utf8"
)

type Item = domain.Item
type Provider interface {
	Search(context.Context, string, string) ([]Item, error)
}
type Service struct{ provider Provider }

func NewService(p Provider) Service { return Service{p} }
func (s Service) Search(ctx context.Context, kind, query string) ([]Item, error) {
	query = strings.TrimSpace(query)
	maxLength := 120
	if kind == "gif" {
		maxLength = 80
	}
	if kind == "youtube" {
		maxLength = 200
	}
	if query == "" || utf8.RuneCountInString(query) > maxLength || (kind != "gif" && kind != "music" && kind != "youtube") {
		return nil, errors.New("invalid_query")
	}
	return s.provider.Search(ctx, kind, query)
}
func Allowed(kind, raw string) bool { return domain.Allowed(kind, raw) }
