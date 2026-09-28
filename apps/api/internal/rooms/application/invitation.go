package application

import "context"

// GameInvitations owns writes of system-generated game cards to the room feed.
// Callers supply a validated projection, never a user-authored message kind.
type GameInvitationStore interface {
	PublishGame(context.Context, string, string, string, string) error
	CancelGames(context.Context) error
}
type GameInvitations struct{ store GameInvitationStore }

func NewGameInvitations(store GameInvitationStore) GameInvitations { return GameInvitations{store} }
func (s GameInvitations) Publish(ctx context.Context, room, id, author, body string) error {
	return s.store.PublishGame(ctx, room, id, author, body)
}
func (s GameInvitations) Cancel(ctx context.Context) error { return s.store.CancelGames(ctx) }
