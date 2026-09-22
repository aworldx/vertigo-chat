package webdelivery

import (
	"net/http"
	"net/netip"
	"net/url"
)

// Loopback aliases must converge before React creates cookies or opens a socket.
// API and WebSocket origin checks stay strict; only local page navigation redirects.
func canonicalPage(origin string, next http.HandlerFunc) http.HandlerFunc {
	canonical, err := url.Parse(origin)
	if err != nil || canonical.Scheme != "http" || !loopback(canonical.Hostname()) {
		return next
	}
	return func(w http.ResponseWriter, r *http.Request) {
		incoming := url.URL{Host: r.Host}
		if r.TLS == nil && incoming.Host != canonical.Host && incoming.Port() == canonical.Port() && loopback(incoming.Hostname()) {
			target := *r.URL
			target.Scheme, target.Host = canonical.Scheme, canonical.Host
			w.Header().Set("Cache-Control", "no-store")
			http.Redirect(w, r, target.String(), http.StatusTemporaryRedirect)
			return
		}
		next(w, r)
	}
}

func loopback(host string) bool {
	if host == "localhost" {
		return true
	}
	address, err := netip.ParseAddr(host)
	return err == nil && address.IsLoopback()
}
