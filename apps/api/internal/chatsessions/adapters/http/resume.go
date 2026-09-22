package http

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

// The random secret is verified against the durable hash on every restore.
// The envelope carries routing information only; neither identity nor session
// ID is trusted without that proof. It is never placed in a URL or cookie.
type Resume struct {
	SessionID   string `json:"session_id"`
	IdentityKey string `json:"identity_key"`
	Secret      string `json:"secret"`
}

func EncodeResume(value Resume) string {
	bytes, _ := json.Marshal(value)
	return base64.RawURLEncoding.EncodeToString(bytes)
}
func DecodeResume(token string) (Resume, error) {
	var value Resume
	if len(token) > 2048 {
		return value, errors.New("invalid resume token")
	}
	bytes, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return value, err
	}
	if err = json.Unmarshal(bytes, &value); err != nil {
		return value, err
	}
	secret, err := base64.RawURLEncoding.DecodeString(value.Secret)
	if err != nil || len(secret) != 32 || len(value.SessionID) != 36 || (!strings.HasPrefix(value.IdentityKey, "guest:") && !strings.HasPrefix(value.IdentityKey, "user:")) {
		return Resume{}, errors.New("invalid resume token")
	}
	return value, nil
}
