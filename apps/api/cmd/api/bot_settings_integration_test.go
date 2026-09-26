package main

import (
	bot "chat/api/internal/bot/application"
	botdomain "chat/api/internal/bot/domain"
	roompg "chat/api/internal/rooms/adapters/postgres"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"
)

func (f *chatFixture) botManagement(t *testing.T) {
	f.post(t, "/api/v1/auth/login", `{"nickname":"fixture01","password":"secret123"}`, 200)
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/budget", `{"daily_tokens":1000,"stop_percent":80}`, 403, false)
	for _, body := range []string{`{}`, `{"stop_percent":90}`, `{"daily_tokens":null,"stop_percent":90}`, `{"daily_tokens":-1,"stop_percent":90}`, `{"daily_tokens":10,"stop_percent":101}`, `{"daily_tokens":100,"stop_percent":90,"extra":1}`, `{"daily_tokens":10,"stop_percent":90} {}`} {
		communityRequest(t, f, "PUT", "/api/v1/admin/bots/budget", body, 422, true)
	}
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/budget", `{"daily_tokens":1000,"stop_percent":80}`, 200, true)
	var overview struct {
		Limits struct {
			Daily   int `json:"daily_tokens"`
			Percent int `json:"stop_percent"`
		}
		Bots []struct{ ID string }
	}
	if err := json.Unmarshal(communityRequest(t, f, "GET", "/api/v1/admin/bots", "", 200, false), &overview); err != nil {
		t.Fatal(err)
	}
	if overview.Limits.Daily != 1000 || overview.Limits.Percent != 80 || len(overview.Bots) != 2 {
		t.Fatal(overview)
	}
	f.botStyles(t)
	f.botBudgetEnforcement(t)

	f.post(t, "/api/v1/auth/login", `{"nickname":"fixture02","password":"secret123"}`, 200)
	communityRequest(t, f, "GET", "/api/v1/admin/bots", "", 403, false)
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/budget", `{"daily_tokens":1,"stop_percent":100}`, 403, true)
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/claire/style", `{}`, 403, true)
	f.post(t, "/api/v1/auth/login", `{"nickname":"fixture01","password":"secret123"}`, 200)
}

func (f *chatFixture) botStyles(t *testing.T) {
	ctx := context.Background()
	_, err := sendBotMessage(ctx, f.pool, roomdomain.Author{RoomID: "bot-style-test", Identity: "bot:claire", Nickname: "Клэр"}, "before-style", "До изменения")
	if err != nil {
		t.Fatal(err)
	}
	style := `{"dark":{"nickname_color":"#123456","text_color":"#ABCDEF"},"light":{"nickname_color":"#654321","text_color":"#fedcba"},"font_id":"serif","font_style":"italic"}`
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/claire/style", style, 200, true)
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/unknown/style", style, 422, true)
	communityRequest(t, f, "PUT", "/api/v1/admin/bots/claire/style", `{}`, 422, true)
	prefs, err := botPreferences(f.pool)(ctx, "claire")
	if err != nil || prefs.Font != "serif" || prefs.Appearance.Dark.Nickname != "#123456" {
		t.Fatal(prefs, err)
	}
	author, err := botAuthor(ctx, f.pool, roomdomain.Author{Identity: "bot:claire"})
	if err != nil || author.FontStyle != "italic" || author.Appearance.Dark.Text != "#abcdef" {
		t.Fatal(author, err)
	}
	f.botStyledMessages(t)
	original, err := botPreferences(f.pool)(ctx, "hitchcock")
	if err != nil || original.Font != "theme" {
		t.Fatal(original, err)
	}
}

func (f *chatFixture) botBudgetEnforcement(t *testing.T) {
	ctx := context.Background()
	store := botStore(f.pool)
	before, err := store.ReadBudget(ctx, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	// Configure relative to the existing ledger; saving limits must never reset usage.
	if err := store.SaveLimits(ctx, bot.Limits{DailyTokens: before.Used + 1, StopPercent: 100}); err != nil {
		t.Fatal(err)
	}
	if err := store.Spend(ctx, func() (botdomain.Result, error) { return botdomain.Result{Total: 2, Input: 1, Output: 1}, nil }); err != nil {
		t.Fatal(err)
	}
	called := false
	generate := func() (botdomain.Result, error) { called = true; return botdomain.Result{}, nil }
	if store.Available(ctx) {
		t.Fatal("budget not enforced")
	}
	if err := store.Spend(ctx, generate); !errors.Is(err, botdomain.ErrUnavailable) || called {
		t.Fatal(err, called)
	}
	if _, err := store.Exchange(ctx, botdomain.Request{ID: "admin-blocked", Identity: "guest:test"}, func(botdomain.Context) (botdomain.Result, error) { called = true; return botdomain.Result{}, nil }, func(botdomain.Result) error { return nil }); !errors.Is(err, botdomain.ErrUnavailable) || called {
		t.Fatal(err, called)
	}
	after, err := store.ReadBudget(ctx, time.Now())
	if err != nil || after.Used != before.Used+2 {
		t.Fatal(after, err)
	}
	if err := store.SaveLimits(ctx, bot.Limits{DailyTokens: 0, StopPercent: 90}); err != nil || !store.Available(ctx) {
		t.Fatal("unlimited", err)
	}
}

func (f *chatFixture) botStyledMessages(t *testing.T) {
	ctx := context.Background()
	message, err := sendBotMessage(ctx, f.pool, roomdomain.Author{RoomID: "bot-style-test", Identity: "bot:claire", Nickname: "Клэр"}, "after-style", "После изменения")
	if err != nil || message.FontID != "serif" || message.Appearance.Dark.Nickname != "#123456" {
		t.Fatal(message, err)
	}
	history, err := roompg.NewStore(f.pool).Recent(ctx, "bot-style-test")
	if err != nil || len(history) != 2 {
		t.Fatal(history, err)
	}
	if history[0].FontID != "theme" || history[1].FontStyle != "italic" {
		t.Fatal(history)
	}
}
