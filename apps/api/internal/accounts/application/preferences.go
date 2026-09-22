package application

import "context"

// ChatProfile exposes only the account data required by the room; no credentials.
type ChatProfile struct {
	UserID         int64  `json:"id"`
	Nickname       string `json:"nickname"`
	Admin          bool   `json:"is_admin"`
	Preferences    []byte
	PublicMessages int `json:"public_message_count"`
	ChatSeconds    int `json:"chat_seconds"`
	Karma          int `json:"karma"`
}
type PreferencesStore interface {
	ChatProfile(context.Context, int64) (ChatProfile, error)
	SavePreferences(context.Context, int64, []byte) error
}
type PreferencesService struct{ store PreferencesStore }

func NewPreferences(store PreferencesStore) PreferencesService { return PreferencesService{store} }
func (s PreferencesService) Get(ctx context.Context, id int64) (ChatProfile, error) {
	return s.store.ChatProfile(ctx, id)
}
func (s PreferencesService) Save(ctx context.Context, id int64, p []byte) error {
	return s.store.SavePreferences(ctx, id, p)
}
