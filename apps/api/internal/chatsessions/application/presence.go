package application

import (
	"chat/api/internal/chatsessions/domain"
	"context"
)

type PresenceReader interface {
	Presence(context.Context, string) ([]domain.Session, error)
}
type Presence struct{ reader PresenceReader }

func NewPresence(reader PresenceReader) Presence { return Presence{reader: reader} }
func (p Presence) List(ctx context.Context, room string) ([]domain.Session, error) {
	return p.reader.Presence(ctx, room)
}
