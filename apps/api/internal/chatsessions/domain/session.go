// Package domain defines the transport-independent chat-session state machine.
package domain

import "time"

type Status string

const (
	StatusActive       Status = "active"
	StatusReconnecting Status = "reconnecting"
	StatusEnded        Status = "ended"
)

type Session struct {
	ID                string
	RoomID            string
	IdentityKey       string
	Nickname          string
	Status            Status
	Generation        int
	VisitID           int64
	ReconnectDeadline *time.Time
}

// Start describes a pre-authorized entrance. Authentication and nickname
// normalization stay at the BFF boundary; this context owns the durable visit
// and session created for that accepted entrance.
type Start struct {
	RoomID      string
	IdentityKey string
	Nickname    string
	UserID      *int64
}

func (s Session) CanRestore(now time.Time) bool {
	if s.Status == StatusEnded {
		return false
	}
	return s.ReconnectDeadline == nil || s.ReconnectDeadline.After(now)
}
