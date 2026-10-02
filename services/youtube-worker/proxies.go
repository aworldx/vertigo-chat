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

// proxyPool reads authenticated HTTP proxies from a secret mounted outside the
// repository. It intentionally keeps credentials out of logs and errors.
type proxyPool struct {
	mu     sync.Mutex
	file   string
	loaded time.Time
	items  []string
	next   int
}

func newProxyPool(file string) *proxyPool {
	if strings.TrimSpace(file) == "" {
		return nil
	}
	return &proxyPool{file: file}
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

// candidates rotates up to three proxies. A reload makes a secret rotation
// effective without restarting the worker.
func (p *proxyPool) candidates() []string {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Since(p.loaded) >= 5*time.Minute {
		raw, err := os.ReadFile(p.file)
		p.items = nil
		if err == nil {
			for _, line := range strings.Split(string(raw), "\n") {
				if address := parseProxyAddress(line); address != "" {
					p.items = append(p.items, address)
				}
			}
		}
		p.loaded = time.Now()
	}
	if len(p.items) == 0 {
		return nil
	}
	n := min(3, len(p.items))
	selected := make([]string, 0, n)
	for i := 0; i < n; i++ {
		selected = append(selected, p.items[(p.next+i)%len(p.items)])
	}
	// Advance one slot, rather than a whole batch: otherwise a two-entry pool
	// would always begin with the same proxy.
	p.next = (p.next + 1) % len(p.items)
	return selected
}
