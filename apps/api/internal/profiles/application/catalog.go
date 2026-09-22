// Package application contains profile use cases and their ports.
package application

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"chat/api/internal/profiles/domain"
)

var (
	ErrInvalidQuery = errors.New("invalid profile query")
	ErrInvalidPage  = errors.New("invalid profile page")
	ErrNotFound     = errors.New("profile not found")
)

type Catalogue interface {
	List(context.Context, string, int, int) (domain.Page, error)
	GetByNickname(context.Context, string) (domain.Profile, error)
}

type Catalog struct {
	repository Catalogue
}

func NewCatalog(repository Catalogue) Catalog { return Catalog{repository: repository} }

func (c Catalog) List(ctx context.Context, query string, page int) (domain.Page, string, error) {
	if !utf8.ValidString(query) || utf8.RuneCountInString(query) > 80 {
		return domain.Page{}, "", ErrInvalidQuery
	}
	if page < 1 {
		return domain.Page{}, "", ErrInvalidPage
	}
	normalized := strings.TrimSpace(query)
	result, err := c.repository.List(ctx, normalized, page, 12)
	return result, normalized, err
}

func (c Catalog) Get(ctx context.Context, nickname string) (domain.Profile, error) {
	if nickname == "" {
		return domain.Profile{}, ErrNotFound
	}
	return c.repository.GetByNickname(ctx, nickname)
}
