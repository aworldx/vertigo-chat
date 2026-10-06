package application

import (
	"chat/api/internal/geogame/domain"
	"context"
)

// Rankings is owned by the game; account credentials determine eligibility.
type Rankings interface {
	Leaders(context.Context) ([]domain.Ranking, error)
}
