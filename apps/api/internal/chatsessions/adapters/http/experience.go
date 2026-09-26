package http

import (
	"chat/api/internal/chatlans/application"
	"chat/api/internal/chatsessions/domain"
	media "chat/api/internal/mediasearch/application"
	rooms "chat/api/internal/rooms/domain"
	"context"
)

type Rank struct {
	Title string `json:"title"`
	Icon  string `json:"icon_url"`
}
type Presentation struct {
	Preferences application.Preferences
	Rank        *Rank
	Admin       bool
	Karma       int
}
type SendMedia func(context.Context, domain.Session, string, media.Item) (rooms.Message, error)
type BotReply func(domain.Session, rooms.Message, string)
type Experience struct {
	HelpTopics      func(string) []string
	BotPresentation func(context.Context, string) (Presentation, error)
	BotAvailable    func(context.Context) bool
	Bot             BotReply
	Media           SendMedia
	React           func(context.Context, domain.Session, int64, string, bool) error
	Delete          func(context.Context, domain.Session, int64) error
	Present         func(context.Context, domain.Session) (Presentation, error)
	Save            func(context.Context, domain.Session, application.Preferences) (application.Preferences, error)
}

func (h Socket) WithExperience(experience Experience) Socket { h.experience = experience; return h }
func (h Socket) presentation(ctx context.Context, s domain.Session) (Presentation, error) {
	if h.experience.Present == nil {
		return Presentation{Preferences: application.Default()}, nil
	}
	return h.experience.Present(ctx, s)
}
