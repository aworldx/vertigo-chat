package provider

import (
	"crypto/sha256"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type proxyEntry struct {
	id             [32]byte
	address        *url.URL
	failures       int
	used, cooldown time.Time
}
type ProxyPool struct {
	mu      sync.Mutex
	file    string
	loaded  time.Time
	entries map[[32]byte]*proxyEntry
}

func NewProxyPool(file string) *ProxyPool {
	return &ProxyPool{file: file, entries: map[[32]byte]*proxyEntry{}}
}

var proxyHost = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)

func parseProxy(line string) *proxyEntry {
	p := strings.SplitN(strings.TrimSpace(line), ":", 4)
	if len(p) != 4 || !proxyHost.MatchString(p[0]) || p[2] == "" || p[3] == "" {
		return nil
	}
	port, err := strconv.Atoi(p[1])
	if err != nil || port < 1 || port > 65535 {
		return nil
	}
	return &proxyEntry{id: sha256.Sum256([]byte(line)), address: &url.URL{Scheme: "http", Host: net.JoinHostPort(p[0], p[1]), User: url.UserPassword(p[2], p[3])}}
}
func (p *ProxyPool) candidates() []proxyEntry {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	if now.Sub(p.loaded) >= 5*time.Minute {
		p.reload(now)
	}
	available, all := []*proxyEntry{}, []*proxyEntry{}
	for _, e := range p.entries {
		all = append(all, e)
		if !e.cooldown.After(now) {
			available = append(available, e)
		}
	}
	if len(available) == 0 {
		available = all
	}
	sort.Slice(available, func(i, j int) bool {
		if available[i].failures != available[j].failures {
			return available[i].failures < available[j].failures
		}
		return available[i].used.Before(available[j].used)
	})
	selected := make([]proxyEntry, 0, min(3, len(available)))
	for _, e := range available[:min(3, len(available))] {
		e.used = now
		selected = append(selected, *e)
	}
	return selected
}
func (p *ProxyPool) reload(now time.Time) {
	raw, err := os.ReadFile(p.file)
	next := map[[32]byte]*proxyEntry{}
	if err == nil {
		for _, line := range strings.Split(string(raw), "\n") {
			e := parseProxy(line)
			if e == nil {
				continue
			}
			if old := p.entries[e.id]; old != nil {
				e = old
			}
			next[e.id] = e
		}
	}
	p.entries = next
	p.loaded = now
}
func (p *ProxyPool) report(id [32]byte, success bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	e := p.entries[id]
	if e == nil {
		return
	}
	if success {
		e.failures = 0
		e.cooldown = time.Time{}
	} else {
		e.failures++
		e.cooldown = time.Now().Add(min(5*time.Second*time.Duration(1<<min(e.failures-1, 5)), 5*time.Minute))
	}
}
func proxyClient(address *url.URL) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = http.ProxyURL(address)
	transport.DialContext = (&net.Dialer{Timeout: 8 * time.Second}).DialContext
	return &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
}
