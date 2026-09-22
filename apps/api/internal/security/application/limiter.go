package application

import (
	"chat/api/internal/security/domain"
	"sync"
	"time"
)

type Limiter struct {
	mu       sync.Mutex
	events   map[string][]time.Time
	receipts map[string]time.Time
}

func NewLimiter() *Limiter {
	return &Limiter{events: map[string][]time.Time{}, receipts: map[string]time.Time{}}
}
func (l *Limiter) allow(key string, rules []domain.Rule, now time.Time) bool {
	recent := make([]time.Time, 0)
	for _, at := range l.events[key] {
		if at.After(now.Add(-rules[len(rules)-1].Window)) {
			recent = append(recent, at)
		}
	}
	l.events[key] = recent
	for _, rule := range rules {
		count := 0
		for _, at := range recent {
			if at.After(now.Add(-rule.Window)) {
				count++
			}
		}
		if count >= rule.Limit {
			return false
		}
	}
	l.events[key] = append(recent, now)
	return true
}
func (l *Limiter) Message(identity, ip, clientID string, guest bool, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	key := identity + ":" + clientID
	if at, ok := l.receipts[key]; ok && at.After(now.Add(-time.Minute)) {
		return true
	}
	if !l.allow("message:"+identity, domain.Messages, now) {
		return false
	}
	if guest && ip != "" && !l.allow("ip:"+ip, domain.GuestIP, now) {
		return false
	}
	l.receipts[key] = now
	l.prune(now)
	return true
}
func (l *Limiter) Media(identity string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	ok := l.allow("media:"+identity, domain.Media, now)
	l.prune(now)
	return ok
}
func (l *Limiter) prune(now time.Time) {
	if len(l.events) > 10000 {
		for key, values := range l.events {
			if len(values) == 0 || values[len(values)-1].Before(now.Add(-time.Hour)) {
				delete(l.events, key)
			}
		}
	}
	if len(l.receipts) > 10000 {
		for key, at := range l.receipts {
			if at.Before(now.Add(-time.Minute)) {
				delete(l.receipts, key)
			}
		}
	}
}
