package application

import "context"

type BotProgressStore interface {
	BotUserID(context.Context, string) (int64, error)
	TickBotPresence(context.Context) error
}

type BotProgress struct{ store BotProgressStore }

func NewBotProgress(store BotProgressStore) BotProgress { return BotProgress{store} }
func (p BotProgress) UserID(ctx context.Context, nickname string) (int64, error) {
	return p.store.BotUserID(ctx, nickname)
}
func (p BotProgress) Tick(ctx context.Context) error { return p.store.TickBotPresence(ctx) }
