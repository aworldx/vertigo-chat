package application

import (
	"chat/api/internal/mediashares/domain"
	"sync"
	"time"
)

type Share = domain.Share
type entry struct {
	share      Share
	expires    time.Time
	requesters map[string]bool
	indices    map[string]map[int]bool
}
type Registry struct {
	mu     sync.Mutex
	shares map[string]*entry
}

func NewRegistry() *Registry { return &Registry{shares: map[string]*entry{}} }
func (r *Registry) prune(now time.Time) {
	for id, e := range r.shares {
		if !e.expires.After(now) {
			delete(r.shares, id)
		}
	}
}
func (r *Registry) Announce(s Share) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prune(time.Now())
	if !domain.Valid(s) || r.shares[s.ID] != nil {
		return false
	}
	r.shares[s.ID] = &entry{s, time.Now().Add(15 * time.Minute), map[string]bool{}, map[string]map[int]bool{}}
	return true
}
func (r *Registry) Request(id, room, owner, peer string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prune(time.Now())
	e := r.shares[id]
	if e == nil || e.share.Room != room || e.share.Owner != owner || owner == peer {
		return false
	}
	e.requesters[peer] = true
	// A fresh request restarts a failed transfer from its first chunk.
	delete(e.indices, peer)
	return true
}
func (r *Registry) Authorize(id, room, from, to string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prune(time.Now())
	e := r.shares[id]
	return e != nil && e.share.Room == room && (e.share.Owner == from && e.requesters[to] || e.share.Owner == to && e.requesters[from])
}
func (r *Registry) Chunk(id, room, from, to string, index, total, size int) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.prune(time.Now())
	e := r.shares[id]
	if e == nil || e.share.Room != room || e.share.Owner != from || !e.requesters[to] {
		return false
	}
	if total != (e.share.Size+17999)/18000 || index < 0 || index >= total || size != min(18000, e.share.Size-index*18000) {
		return false
	}
	if e.indices[to] == nil {
		e.indices[to] = map[int]bool{}
	}
	if e.indices[to][index] {
		return false
	}
	e.indices[to][index] = true
	return true
}
func (r *Registry) Close(peer string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, e := range r.shares {
		if e.share.Owner == peer {
			delete(r.shares, id)
		} else {
			delete(e.requesters, peer)
			delete(e.indices, peer)
		}
	}
}
