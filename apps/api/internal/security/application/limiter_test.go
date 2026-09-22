package application

import (
	"testing"
	"time"
)

func TestLegacyWindowsAndSharedPublicPrivateBudget(t *testing.T) {
	l := NewLimiter()
	now := time.Now()
	for i := range 3 {
		if !l.Message("user:1", "ip", string(rune('a'+i)), false, now) {
			t.Fatal("early block")
		}
	}
	if l.Message("user:1", "ip", "four", false, now) {
		t.Fatal("burst exceeded")
	}
	if !l.Message("user:1", "ip", "a", false, now) {
		t.Fatal("idempotent retry charged twice")
	}
	for i := range 9 {
		if !l.Message("user:1", "ip", string(rune('e'+i)), false, now.Add(time.Duration(i+1)*3*time.Second)) {
			t.Fatal("early minute block")
		}
	}
	if l.Message("user:1", "ip", "thirteen", false, now.Add(40*time.Second)) {
		t.Fatal("minute quota exceeded")
	}
	if !l.Message("user:1", "ip", "later", false, now.Add(time.Minute+time.Second)) {
		t.Fatal("expired quota retained")
	}
}
func TestGuestIPAndFileQuotas(t *testing.T) {
	l := NewLimiter()
	now := time.Now()
	for i := range 30 {
		if !l.Message(string(rune('a'+i)), "same-ip", "one", true, now) {
			t.Fatal("early IP block")
		}
	}
	if l.Message("different-guest", "same-ip", "one", true, now) {
		t.Fatal("IP quota bypass")
	}
	for i := range 10 {
		if !l.Media("user:1", now.Add(time.Duration(i)*61*time.Second)) {
			t.Fatal("early media block")
		}
	}
	if l.Media("user:1", now.Add(11*time.Minute)) {
		t.Fatal("hourly media quota exceeded")
	}
}
