package provider

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestProxyFileAndCooldown(t *testing.T) {
	path := filepath.Join(t.TempDir(), "proxies.txt")
	if err := os.WriteFile(path, []byte("first.example:8080:user:pass:with:colon\nsecond.example:3128:u:p\ninvalid\nfirst.example:8080:user:pass:with:colon\n"), 0600); err != nil {
		t.Fatal(err)
	}
	pool := NewProxyPool(path)
	initial := pool.candidates()
	if len(initial) != 2 {
		t.Fatal("invalid dedupe/parse", len(initial))
	}
	failed := initial[0]
	pool.report(failed.id, false)
	next := pool.candidates()
	if len(next) != 1 || next[0].id == failed.id {
		t.Fatal("cooldown not applied")
	}
	pool.report(failed.id, true)
	if len(pool.candidates()) != 2 {
		t.Fatal("success did not restore proxy")
	}
	pool.loaded = time.Now().Add(-6 * time.Minute)
	if err := os.WriteFile(path, []byte("replacement.example:8080:u:p\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if got := pool.candidates(); len(got) != 1 || got[0].address.Hostname() != "replacement.example" {
		t.Fatal("file not reloaded")
	}
}
