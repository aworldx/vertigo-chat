package application

import (
	"chat/api/internal/profiles/domain"
	"context"
)

type AccountReader interface {
	GetByUserID(context.Context, int64) (domain.Profile, error)
}

type AccountCatalog struct{ reader AccountReader }

func NewAccountCatalog(reader AccountReader) AccountCatalog { return AccountCatalog{reader: reader} }
func (c AccountCatalog) Get(ctx context.Context, actorID int64) (domain.Profile, error) {
	if actorID < 1 {
		return domain.Profile{}, ErrNotFound
	}
	return c.reader.GetByUserID(ctx, actorID)
}
