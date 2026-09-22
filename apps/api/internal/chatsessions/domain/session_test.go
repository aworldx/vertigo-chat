package domain

import (
	"testing"
	"time"
)

func TestCanRestoreRejectsEndedAndExpiredSessions(t *testing.T) {
	now := time.Now().UTC()
	if (Session{Status: StatusEnded}).CanRestore(now) {
		t.Fatal("ended session is restorable")
	}
	past := now.Add(-time.Second)
	if (Session{Status: StatusReconnecting, ReconnectDeadline: &past}).CanRestore(now) {
		t.Fatal("expired session is restorable")
	}
	if !(Session{Status: StatusActive}).CanRestore(now) {
		t.Fatal("active session is not restorable")
	}
}
