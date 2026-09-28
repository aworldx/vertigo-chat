package http

// Recent tombstones reconcile acknowledgements that raced with moderation.
// The database remains authoritative; this bounded transport history is also
// included on reconnect so a temporarily offline author receives the deletion.
func (h *hub) rememberDeletion(room string, id int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	ids := h.deleted[room]
	for _, previous := range ids {
		if previous == id {
			return
		}
	}
	ids = append(ids, id)
	if len(ids) > 1024 {
		ids = ids[len(ids)-1024:]
	}
	h.deleted[room] = ids
}
func (h *hub) deletions(room string) []int64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]int64(nil), h.deleted[room]...)
}
