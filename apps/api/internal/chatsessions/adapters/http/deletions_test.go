package http

import "testing"

func TestDeletionHistoryIsBoundedAndRoomScoped(t *testing.T) {
	h := newHub()
	for id := int64(1); id <= 1030; id++ {
		h.rememberDeletion("main", id)
	}
	h.rememberDeletion("main", 1030)
	ids := h.deletions("main")
	if len(ids) != 1024 || ids[0] != 7 || ids[1023] != 1030 {
		t.Fatal(ids)
	}
	ids[0] = 9999
	if h.deletions("main")[0] != 7 || len(h.deletions("other")) != 0 {
		t.Fatal("deletion history leaked")
	}
}
