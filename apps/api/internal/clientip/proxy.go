// Package clientip normalizes peers only behind explicitly trusted proxies.
package clientip

import (
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// Wrap preserves RemoteAddr for direct clients and rejects malformed proxy chains.
// Walk from the nearest proxy so an untrusted client's supplied prefix is ignored.
func Wrap(next http.Handler, configuration string) (http.Handler, error) {
	var trusted []netip.Prefix
	for _, value := range strings.Split(configuration, ",") {
		if strings.TrimSpace(value) == "" {
			continue
		}
		prefix, err := netip.ParsePrefix(strings.TrimSpace(value))
		if err != nil {
			return nil, fmt.Errorf("invalid trusted proxy prefix: %w", err)
		}
		trusted = append(trusted, prefix)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		peer, err := netip.ParseAddrPort(r.RemoteAddr)
		if err != nil || !contains(trusted, peer.Addr()) {
			next.ServeHTTP(w, r)
			return
		}
		chain := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		address := peer.Addr()
		for i := len(chain) - 1; i >= 0 && contains(trusted, address); i-- {
			address, err = netip.ParseAddr(strings.TrimSpace(chain[i]))
			if err != nil || address.Zone() != "" {
				http.Error(w, "invalid forwarded peer", http.StatusBadRequest)
				return
			}
		}
		copy := r.Clone(r.Context())
		copy.RemoteAddr = net.JoinHostPort(address.Unmap().String(), "0")
		next.ServeHTTP(w, copy)
	}), nil
}

func contains(prefixes []netip.Prefix, address netip.Addr) bool {
	for _, prefix := range prefixes {
		if prefix.Contains(address.Unmap()) {
			return true
		}
	}
	return false
}
