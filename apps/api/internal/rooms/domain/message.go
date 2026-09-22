package domain

import (
	"errors"
	"time"
)

var ErrRateLimited = errors.New("message rate limited")

// Message is the durable room projection, independent of its wire encoding.
type Message struct {
	MediaURL, Artist, Duration, SourceURL string
	Reactions                             map[string][]string
	Recipient                             string
	Inserted                              bool
	ID                                    int64
	ClientID, Kind, Author, Body          string
	SentAt                                time.Time
	Appearance                            Appearance
	FontID, FontStyle                     string
}
type Colors struct {
	Nickname string `json:"nickname_color"`
	Text     string `json:"text_color"`
}
type Appearance struct {
	Dark  Colors `json:"dark"`
	Light Colors `json:"light"`
}
type Author struct {
	RoomID, Identity, Nickname string
	Recipient                  string
	Appearance                 *Appearance
	FontID, FontStyle          string
}
