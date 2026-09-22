package domain

import (
	"errors"
	"time"
)

var ErrRateLimited = errors.New("message rate limited")

// Message is the durable room projection, independent of its wire encoding.
type Message struct {
	Inserted                     bool
	ID                           int64
	ClientID, Kind, Author, Body string
	SentAt                       time.Time
	Appearance                   Appearance
	FontID, FontStyle            string
}
type Colors struct{ Nickname, Text string }
type Appearance struct{ Dark, Light Colors }
type Author struct{ RoomID, Identity, Nickname string }
