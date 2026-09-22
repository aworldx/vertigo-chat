package domain

import (
	"errors"
	"time"
)

var ErrRateLimited = errors.New("message rate limited")

type Message struct {
	Inserted bool      `json:"-"`
	ID       int64     `json:"id"`
	ClientID string    `json:"client_id"`
	Kind     string    `json:"kind"`
	Author   string    `json:"author"`
	Body     string    `json:"body"`
	SentAt   time.Time `json:"sent_at"`
}
type Author struct{ RoomID, Identity, Nickname string }
