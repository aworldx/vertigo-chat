package http

import (
	"chat/api/internal/accounts/application"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/netip"
	"net/url"
	"time"
)

func validateOrigin(origin string) (bool, error) {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return false, fmt.Errorf("API_PUBLIC_ORIGIN must be an exact origin without path")
	}
	if parsed.Scheme == "https" {
		return true, nil
	}
	ip, err := netip.ParseAddr(parsed.Hostname())
	if parsed.Scheme == "http" && (parsed.Hostname() == "localhost" || (err == nil && ip.IsLoopback())) {
		return false, nil
	}
	return false, fmt.Errorf("API_PUBLIC_ORIGIN requires HTTPS outside loopback")
}

func csrfToken(token string) string {
	digest := sha256.Sum256([]byte("account-csrf:" + token))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func (h Handler) token(r *http.Request) string {
	cookie, err := r.Cookie(h.cookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func (h Handler) sameOrigin(r *http.Request) bool {
	parsed, err := url.Parse(h.origin)
	if err != nil || r.Host != parsed.Host {
		h.logOriginRejection(r, "host")
		return false
	}
	if origin := r.Header.Get("Origin"); origin != "" && origin != h.origin {
		h.logOriginRejection(r, "origin")
		return false
	}
	site := r.Header.Get("Sec-Fetch-Site")
	if site != "" && site != "same-origin" && site != "none" {
		h.logOriginRejection(r, "fetch_site")
		return false
	}
	return true
}

func (h Handler) logOriginRejection(r *http.Request, reason string) {
	// Log only the origin boundary, never credentials, cookies or CSRF tokens.
	slog.Warn("account origin rejected", "reason", reason, "method", r.Method,
		"path", r.URL.Path, "host", r.Host, "origin", r.Header.Get("Origin"),
		"fetch_site", r.Header.Get("Sec-Fetch-Site"))
}

func (h Handler) authorized(w http.ResponseWriter, r *http.Request) bool {
	token := h.token(r)
	if !h.sameOrigin(r) || token == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(csrfToken(token))) != 1 {
		writeError(w, http.StatusForbidden, "forbidden")
		return false
	}
	if _, err := h.sessions.Current(r.Context(), token, time.Now()); err != nil {
		writeFailure(w, err)
		return false
	}
	return true
}

func (h Handler) setCookie(w http.ResponseWriter, token string, expires time.Time) {
	maxAge := int(time.Until(expires).Seconds())
	if token == "" {
		maxAge = -1
	}
	http.SetCookie(w, &http.Cookie{Name: h.cookieName, Value: token, Path: "/", HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode, Expires: expires, MaxAge: maxAge})
}

// AuthorizeMutation lets the composition root share the site's CSRF boundary
// with entrance without exposing account repositories to another context.
func (h Handler) AuthorizeMutation(w http.ResponseWriter, r *http.Request) (string, bool) {
	if !h.authorized(w, r) {
		return "", false
	}
	return h.token(r), true
}

func (h Handler) SetSessionCookie(w http.ResponseWriter, token string, expires time.Time) {
	h.setCookie(w, token, expires)
}

// AccountIdentity exposes only the verified actor and HTTP failure status to
// other HTTP adapters. Neither caller-supplied IDs nor internal tokens identify
// a browser user. Business contexts still enforce ownership themselves.
func (h Handler) AccountIdentity(r *http.Request, mutation bool) (int64, int) {
	if !h.sameOrigin(r) {
		return 0, http.StatusForbidden
	}
	token := h.token(r)
	record, err := h.sessions.Current(r.Context(), token, time.Now())
	if errors.Is(err, application.ErrInvalidSession) || (err == nil && record.UserID == 0) {
		return 0, http.StatusUnauthorized
	}
	if err != nil {
		return 0, http.StatusServiceUnavailable
	}
	if mutation && subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(csrfToken(token))) != 1 {
		return 0, http.StatusForbidden
	}
	if _, err := h.authenticator.Principal(r.Context(), record.UserID); err != nil {
		if errors.Is(err, application.ErrInvalidCredentials) {
			return 0, http.StatusUnauthorized
		}
		return 0, http.StatusServiceUnavailable
	}
	return record.UserID, 0
}
