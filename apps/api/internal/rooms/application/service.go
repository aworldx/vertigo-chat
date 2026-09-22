package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"strings"
	"unicode/utf8"
)

var ErrInvalidMessage = errors.New("invalid message")

type Store interface {
	Send(context.Context, domain.Author, string, string) (domain.Message, error)
	Recent(context.Context, string) ([]domain.Message, error)
}
type Service struct{ store Store }

func NewService(store Store) Service { return Service{store} }
func (s Service) Send(ctx context.Context, author domain.Author, clientID, body string) (domain.Message, error) {
	body = strings.TrimSpace(body)
	if clientID == "" || len(clientID) > 64 || body == "" || utf8.RuneCountInString(body) > 1000 {
		return domain.Message{}, ErrInvalidMessage
	}
	return s.store.Send(ctx, author, clientID, body)
}
func (s Service) Recent(ctx context.Context, roomID string) ([]domain.Message, error) {
	return s.store.Recent(ctx, roomID)
}
