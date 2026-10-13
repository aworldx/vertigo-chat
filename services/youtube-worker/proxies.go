package main

import (
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// proxyPool keeps credentials only in memory. The seed file gives the worker
// usable candidates while the background scan checks the source file.
type proxyPool struct {
	mu        sync.Mutex
	items     []proxyState
	next      int
	checkedAt time.Time
	readOK    bool
}

type proxyState struct {
	address string
	working bool
}

var proxyHostname = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)

func parseProxyAddress(line string) string {
	parts := strings.SplitN(strings.TrimSpace(line), ":", 4)
	if len(parts) != 4 || !proxyHostname.MatchString(parts[0]) || parts[2] == "" || parts[3] == "" {
		return ""
	}
	port, err := strconv.Atoi(parts[1])
	if err != nil || port < 1 || port > 65535 {
		return ""
	}
	return (&url.URL{Scheme: "http", Host: net.JoinHostPort(parts[0], parts[1]), User: url.UserPassword(parts[2], parts[3])}).String()
}

func readProxies(file string) ([]proxyState, error) {
	raw, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	items := []proxyState{}
	for _, line := range strings.Split(string(raw), "\n") {
		address := parseProxyAddress(line)
		if address == "" || seen[address] {
			continue
		}
		seen[address] = true
		items = append(items, proxyState{address: address})
	}
	return items, nil
}

func newProxyPool(file string) *proxyPool {
	if strings.TrimSpace(file) == "" {
		return nil
	}
	items, _ := readProxies(file)
	return &proxyPool{items: items}
}

func (p *proxyPool) candidates() []string {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.items) == 0 {
		return nil
	}
	selected := make([]string, 0, min(3, len(p.items)))
	start := p.next % len(p.items)
	p.next = (start + 1) % len(p.items)
	for offset := range p.items {
		entry := p.items[(start+offset)%len(p.items)]
		if p.checkedAt.IsZero() || entry.working {
			selected = append(selected, entry.address)
			if len(selected) == 3 {
				break
			}
		}
	}
	// If the last scan found no working proxy, keep trying the source list:
	// a temporary upstream outage must not permanently block new videos.
	if len(selected) == 0 {
		for i := 0; i < min(3, len(p.items)); i++ {
			selected = append(selected, p.items[(start+i)%len(p.items)].address)
		}
	}
	return selected
}

func (p *proxyPool) snapshot() (total, working int, checkedAt time.Time, readOK bool) {
	if p == nil {
		return 0, 0, time.Time{}, false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.checkedAt.IsZero() {
		return 0, 0, time.Time{}, false
	}
	for _, item := range p.items {
		if item.working {
			working++
		}
	}
	return len(p.items), working, p.checkedAt, p.readOK
}
