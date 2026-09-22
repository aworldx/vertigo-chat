package application

import "testing"

func TestRelayAuthorizationAndByteAccounting(t *testing.T) {
	r := NewRegistry()
	s := Share{ID: "12345678-1234-4234-8234-123456789abc", Name: "a.png", MIME: "image/png", Size: 20000, Owner: "owner", Room: "room"}
	if !r.Announce(s) {
		t.Fatal("announce")
	}
	if r.Authorize(s.ID, "room", "owner", "stranger") {
		t.Fatal("unsolicited transfer")
	}
	if !r.Request(s.ID, "room", "owner", "reader") {
		t.Fatal("request")
	}
	if r.Chunk(s.ID, "room", "reader", "owner", 0, 2, 18000) {
		t.Fatal("non-owner sends")
	}
	if !r.Chunk(s.ID, "room", "owner", "reader", 0, 2, 18000) {
		t.Fatal("first chunk")
	}
	if r.Chunk(s.ID, "room", "owner", "reader", 0, 2, 18000) {
		t.Fatal("duplicate chunk")
	}
	if r.Chunk(s.ID, "room", "owner", "reader", 1, 2, 1999) {
		t.Fatal("wrong final size")
	}
	if !r.Chunk(s.ID, "room", "owner", "reader", 1, 2, 2000) {
		t.Fatal("last chunk")
	}
	if !r.Request(s.ID, "room", "owner", "reader") || !r.Chunk(s.ID, "room", "owner", "reader", 0, 2, 18000) {
		t.Fatal("retry must accept the first chunk again")
	}
	if r.Chunk(s.ID, "room", "owner", "reader", 0, 2, 18000) {
		t.Fatal("retry must still reject duplicate chunks")
	}
	r.Close("owner")
	if r.Authorize(s.ID, "room", "owner", "reader") {
		t.Fatal("closed share retained")
	}
}
