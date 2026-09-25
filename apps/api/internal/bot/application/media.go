package application

import (
	"context"
	"sync"
	"time"
)

// Media rate-limits even failed searches, so conversations cannot flood providers.
// The media adapter owns search validation and publication; no arbitrary commands execute.
type Media struct {
	mu       sync.Mutex
	next     time.Time
	Now      func() time.Time
	Eligible func(context.Context, string) bool
	Publish  func(context.Context, string, string, string, string, func() bool) error
}

func (m *Media) Ready(ctx context.Context, room string) bool {
	if m == nil || (m.Eligible != nil && !m.Eligible(ctx, room)) {
		return false
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return !m.Now().Before(m.next)
}

func (m *Media) Suggest(ctx context.Context, room, id, kind, query string, allowed func() bool) {
	if kind == "" || query == "" || (allowed != nil && !allowed()) || !m.Ready(ctx, room) {
		return
	}
	m.mu.Lock()
	now := m.Now()
	if now.Before(m.next) {
		m.mu.Unlock()
		return
	}
	m.next = now.Add(30 * time.Minute)
	m.mu.Unlock()
	_ = m.Publish(ctx, room, id, kind, query, func() bool {
		return (allowed == nil || allowed()) && (m.Eligible == nil || m.Eligible(ctx, room))
	})
}
