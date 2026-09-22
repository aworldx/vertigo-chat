package http

import (
	roomapp "chat/api/internal/rooms/application"
	rooms "chat/api/internal/rooms/domain"
	"regexp"
	"time"
)

type messageColors struct {
	Nickname string `json:"nickname_color"`
	Text     string `json:"text_color"`
}
type messageAppearance struct {
	Dark  messageColors `json:"dark"`
	Light messageColors `json:"light"`
}
type messageDTO struct {
	MediaURL   string            `json:"media_url"`
	Artist     string            `json:"artist"`
	Duration   string            `json:"duration"`
	SourceURL  string            `json:"source_url"`
	Reactions  map[string]int    `json:"reactions"`
	Reacted    []string          `json:"reacted"`
	Recipient  string            `json:"recipient"`
	ID         int64             `json:"id"`
	ClientID   string            `json:"client_id"`
	Kind       string            `json:"kind"`
	Author     string            `json:"author"`
	Body       string            `json:"body"`
	SentAt     time.Time         `json:"sent_at"`
	Appearance messageAppearance `json:"appearance"`
	FontID     string            `json:"font_id"`
	FontStyle  string            `json:"font_style"`
}

var storedVideoID = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

func encodeMessage(message rooms.Message, viewer ...string) messageDTO {
	if message.Kind == "youtube" && storedVideoID.MatchString(message.MediaURL) {
		message.MediaURL = "/youtube-proxy/" + message.MediaURL
	}
	reactions := make(map[string]int)
	reacted := make([]string, 0)
	for _, emoji := range roomapp.ReactionEmojis {
		actors := message.Reactions[emoji]
		reactions[emoji] = len(actors)
		for _, actor := range actors {
			if len(viewer) > 0 && actor == viewer[0] {
				reacted = append(reacted, emoji)
				break
			}
		}
	}
	return messageDTO{MediaURL: message.MediaURL, Artist: message.Artist, Duration: message.Duration, SourceURL: message.SourceURL, Reactions: reactions, Reacted: reacted, Recipient: message.Recipient,
		ID: message.ID, ClientID: message.ClientID, Kind: message.Kind,
		Author: message.Author, Body: message.Body, SentAt: message.SentAt,
		Appearance: messageAppearance{
			Dark:  messageColors{message.Appearance.Dark.Nickname, message.Appearance.Dark.Text},
			Light: messageColors{message.Appearance.Light.Nickname, message.Appearance.Light.Text},
		}, FontID: message.FontID, FontStyle: message.FontStyle,
	}
}
