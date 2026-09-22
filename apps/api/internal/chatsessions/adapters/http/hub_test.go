package http

import (
	"chat/api/internal/chatsessions/domain"
	"testing"
)

func TestPrivateRoutingFencingAndIdempotency(t *testing.T) {
	h := newHub()
	sender := domain.Session{ID: "a", IdentityKey: "guest:a", Generation: 1, RoomID: "main"}
	recipient := domain.Session{ID: "b", Generation: 1, RoomID: "main"}
	_, stopA := h.subscribe(sender)
	defer stopA()
	events, stopB := h.subscribe(recipient)
	defer stopB()
	message := messageDTO{ClientID: "one", Body: "secret"}
	first, ok := h.direct(sender, recipient, message)
	if !ok {
		t.Fatal("not delivered")
	}
	if received := <-events; received.ID != first.ID {
		t.Fatal("different event")
	}
	second, ok := h.direct(sender, recipient, message)
	if !ok || first.ID != second.ID {
		t.Fatal("replay not stable")
	}
	select {
	case <-events:
		t.Fatal("replayed private message")
	default:
	}
	recipient.Generation = 2
	_, stopNew := h.subscribe(recipient)
	defer stopNew()
	recipient.Generation = 1
	if _, ok := h.direct(sender, recipient, messageDTO{ClientID: "two"}); ok {
		t.Fatal("delivered to wrong generation")
	}
}
