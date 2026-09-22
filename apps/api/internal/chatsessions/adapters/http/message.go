package http

import (
	rooms "chat/api/internal/rooms/domain"
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

func encodeMessage(message rooms.Message) messageDTO {
	return messageDTO{
		ID: message.ID, ClientID: message.ClientID, Kind: message.Kind,
		Author: message.Author, Body: message.Body, SentAt: message.SentAt,
		Appearance: messageAppearance{
			Dark:  messageColors{message.Appearance.Dark.Nickname, message.Appearance.Dark.Text},
			Light: messageColors{message.Appearance.Light.Nickname, message.Appearance.Light.Text},
		}, FontID: message.FontID, FontStyle: message.FontStyle,
	}
}
