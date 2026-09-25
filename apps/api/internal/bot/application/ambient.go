package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"time"
)

type Audience struct {
	Humans    int
	LastHuman time.Time
	History   []AmbientMessage
}
type Turn struct {
	Speaker domain.Persona
	Body    string
	Closing bool
}
type AmbientPorts struct {
	Audience   func(context.Context) (Audience, error)
	Talk       func(context.Context, Turn, func() bool) (string, error)
	Now        func() time.Time
	Delay      func() time.Duration
	MediaReady func(context.Context) bool
}

// Ambient is driven by one leader's ticker. It never recursively dispatches bot replies.
type Ambient struct {
	ports       AmbientPorts
	next        time.Time
	turns       int
	last        string
	crowded     bool
	loaded      bool
	history     []AmbientMessage
	lastSpeaker string
}

func NewAmbient(p AmbientPorts) *Ambient { return &Ambient{ports: p} }
func (a *Ambient) Tick(ctx context.Context) error {
	audience, err := a.ports.Audience(ctx)
	if err != nil {
		return err
	}
	now := a.ports.Now()
	if !a.loaded {
		a.restore(audience.History, now)
		a.loaded = true
	}
	if !a.due(now, audience) {
		return nil
	}
	turn := a.turn(audience.Humans > 1)
	a.mediaOpportunity(ctx, &turn)
	allowed := func() bool {
		current, err := a.ports.Audience(ctx)
		if err != nil || current.Humans == 0 || ctx.Err() != nil {
			return false
		}
		if !turn.Closing && current.Humans != 1 {
			return false
		}
		return !current.LastHuman.After(audience.LastHuman)
	}
	text, err := a.ports.Talk(ctx, turn, allowed)
	a.next = a.ports.Now().Add(a.ports.Delay())
	if err != nil {
		delay := 5 * time.Minute
		var limited domain.RateLimited
		if errors.As(err, &limited) && limited.RetryAfter > delay {
			delay = limited.RetryAfter
		}
		a.next = a.ports.Now().Add(delay)
		return err
	}
	if text == "" {
		return nil
	}
	a.last = text
	a.lastSpeaker = turn.Speaker.ID
	a.remember(AmbientMessage{Speaker: turn.Speaker.ID, Body: text, SentAt: a.ports.Now()})
	a.turns++
	if turn.Closing {
		a.crowded = true
		a.turns = 0
		a.last = ""
	}
	if a.turns >= 6 {
		a.turns = 0
		a.last = ""
		a.next = a.ports.Now().Add(10 * time.Minute)
	}
	return nil
}
func (a *Ambient) due(now time.Time, audience Audience) bool {
	if audience.Humans == 0 {
		a.next = time.Time{}
		a.turns = 0
		a.last = ""
		a.crowded = false
		return false
	}
	if audience.Humans > 1 && (a.turns == 0 || a.crowded) {
		a.crowded = true
		return false
	}
	if a.next.IsZero() || (audience.Humans == 1 && a.crowded) {
		a.next = now.Add(90 * time.Second)
		a.crowded = false
	}
	return !now.Before(a.next) && now.Sub(audience.LastHuman) >= 90*time.Second
}
func (a *Ambient) turn(closing bool) Turn {
	p := domain.Claire()
	if a.last != "" && a.lastSpeaker == "claire" {
		p = domain.Hitchcock()
	}
	body := "Начни короткий разговор с Хичкоком. Выбери новую тему из своей жизни, без обязательного вопроса и без перевода разговора на музыку."
	if a.last != "" {
		body = "Продолжи последнюю реплику собеседника: отреагируй на его мысль, не начинай новую историю. От первого лица, коротко."
	}
	body += a.recentContext()
	if closing {
		body += " Теперь мягко заверши разговор: одна короткая реплика без вопроса, уступи место другим, без объяснения причин."
	}
	return Turn{Speaker: p, Body: body, Closing: closing}
}

func (a *Ambient) mediaOpportunity(ctx context.Context, turn *Turn) {
	if !turn.Closing && turn.Speaker.ID == "claire" && a.turns >= 2 && a.ports.MediaReady != nil && a.ports.MediaReady(ctx) {
		turn.Body += "\nУказание для твоего ответа: подбери одну уместную песню или видео и добавь отдельной строкой /music исполнитель - песня либо /video запрос. Не спрашивай разрешения и не обещай воспроизведение."
	}
}
