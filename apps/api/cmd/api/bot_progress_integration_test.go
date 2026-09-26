package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	profilespg "chat/api/internal/profiles/adapters/postgres"
	profiles "chat/api/internal/profiles/application"
	profiledomain "chat/api/internal/profiles/domain"
	roomdomain "chat/api/internal/rooms/domain"
	"chat/api/migrations"
	"context"
	"testing"
)

func (f *chatFixture) botProfiles(t *testing.T) {
	f.checkBotAccounts(t)
	f.checkBotRanks(t)
	before := f.readBotProfile(t)
	f.recordBotProgress(t)
	after := f.readBotProfile(t)
	if after.PublicMessageCount != before.PublicMessageCount+1 || after.Karma != before.Karma+1 || after.ChatSeconds < before.ChatSeconds+60 || after.ChatSeconds > before.ChatSeconds+62 {
		t.Fatalf("before %+v after %+v", before, after)
	}
	f.checkBotRetention(t, after)
}

func (f *chatFixture) readBotProfile(t *testing.T) profiledomain.Profile {
	t.Helper()
	p, err := profiles.NewCatalog(profilespg.NewCatalogue(f.pool)).Get(context.Background(), "Клэр")
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func (f *chatFixture) checkBotAccounts(t *testing.T) {
	ctx := context.Background()
	account := accountspg.NewAccounts(f.pool)
	progress := accounts.NewBotProgress(account)
	catalog := profiles.NewCatalog(profilespg.NewCatalogue(f.pool))
	for _, name := range []string{"Клэр", "Хичкок"} {
		p, err := catalog.Get(ctx, name)
		if err != nil || !p.HasPhoto || !p.HasThumbnail || p.About == nil {
			t.Fatalf("profile %s: %+v %v", name, p, err)
		}
		id, err := progress.UserID(ctx, name)
		if err != nil {
			t.Fatal(err)
		}
		if _, _, err := account.FindByNickname(ctx, name); err == nil {
			t.Fatal("bot can authenticate")
		}
		if _, err := account.FindPrincipal(ctx, id); err == nil {
			t.Fatal("bot can own browser session")
		}
	}
}
func (f *chatFixture) recordBotProgress(t *testing.T) {
	ctx := context.Background()
	account := accountspg.NewAccounts(f.pool)
	progress := accounts.NewBotProgress(account)
	id, err := progress.UserID(ctx, "Клэр")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE room_messages SET sent_at=(now() AT TIME ZONE 'UTC')-interval '2 minutes' WHERE author_identity='bot:claire'`); err != nil {
		t.Fatal(err)
	}
	author := roomdomain.Author{RoomID: "lobby", Identity: "bot:claire", Nickname: "Клэр"}
	for range 2 {
		if _, err := sendBotMessage(ctx, f.pool, author, "profile-counter-test", "Сегодня хороший день!"); err != nil {
			t.Fatal(err)
		}
	}
	if err := accounts.NewKarma(account).Adjust(ctx, id, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE registered_users SET bot_seen_at=now()-interval '60 seconds' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if err := progress.Tick(ctx); err != nil {
		t.Fatal(err)
	}
	if err := progress.Tick(ctx); err != nil {
		t.Fatal(err)
	}
}
func (f *chatFixture) checkBotRetention(t *testing.T, after profiledomain.Profile) {
	ctx := context.Background()
	account := accountspg.NewAccounts(f.pool)
	progress := accounts.NewBotProgress(account)
	catalog := profiles.NewCatalog(profilespg.NewCatalogue(f.pool))
	id, err := progress.UserID(ctx, "Клэр")
	if err != nil {
		t.Fatal(err)
	}
	if err := migrations.Apply(ctx, f.pool); err != nil {
		t.Fatal(err)
	}
	retained, err := catalog.Get(ctx, "Клэр")
	if err != nil || retained.Karma != after.Karma || retained.PublicMessageCount != after.PublicMessageCount {
		t.Fatal("migration reset progress", retained, err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE registered_users SET bot_seen_at=now()-interval '1 day' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if err := progress.Tick(ctx); err != nil {
		t.Fatal(err)
	}
	retained, err = catalog.Get(ctx, "Клэр")
	if err != nil || retained.ChatSeconds != after.ChatSeconds {
		t.Fatal("counted offline time", retained, err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	runBotPresence(cancelled, f.pool)
	if _, err := sendBotMessage(ctx, f.pool, roomdomain.Author{Nickname: "missing"}, "missing", "missing"); err == nil {
		t.Fatal("unregistered bot published")
	}
}

func (f *chatFixture) checkBotRanks(t *testing.T) {
	ctx := context.Background()
	for id, name := range map[string]string{"claire": "Клэр", "hitchcock": "Хичкок"} {
		profile, err := profiles.NewCatalog(profilespg.NewCatalogue(f.pool)).Get(ctx, name)
		if err != nil {
			t.Fatal(err)
		}
		title, icon := profiles.Rank(profile.PublicMessageCount, profile.ChatSeconds)
		presentation, err := botPresentation(f.pool)(ctx, id)
		if err != nil || presentation.Rank == nil {
			t.Fatal(presentation, err)
		}
		if presentation.Rank.Title != title || presentation.Rank.Icon != "/images/ranks/"+icon+".svg" {
			t.Fatal(presentation.Rank)
		}
	}
}
