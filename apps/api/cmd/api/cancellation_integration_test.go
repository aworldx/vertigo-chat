package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	botpg "chat/api/internal/bot/adapters/postgres"
	botdomain "chat/api/internal/bot/domain"
	chatpg "chat/api/internal/chatsessions/adapters/postgres"
	chatdomain "chat/api/internal/chatsessions/domain"
	emojipg "chat/api/internal/emojis/adapters/postgres"
	emojis "chat/api/internal/emojis/application"
	emojidomain "chat/api/internal/emojis/domain"
	feedbackpg "chat/api/internal/feedback/adapters/postgres"
	feedbackdomain "chat/api/internal/feedback/domain"
	gallerypg "chat/api/internal/gallery/adapters/postgres"
	gallerydomain "chat/api/internal/gallery/domain"
	karmikpg "chat/api/internal/karmik/adapters/postgres"
	karmikdomain "chat/api/internal/karmik/domain"
	librarypg "chat/api/internal/library/adapters/postgres"
	librarydomain "chat/api/internal/library/domain"
	chartpg "chat/api/internal/musicchart/adapters/postgres"
	chartdomain "chat/api/internal/musicchart/domain"
	profilespg "chat/api/internal/profiles/adapters/postgres"
	profilesdomain "chat/api/internal/profiles/domain"
	"context"
	"testing"
	"time"
)

func (f *chatFixture) cancelledPersistence(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	checks := []struct {
		name string
		call func() error
	}{
		{"account lookup", func() error { _, _, err := accountspg.NewAccounts(f.pool).FindByNickname(ctx, "fixture01"); return err }},
		{"account principal", func() error { _, err := accountspg.NewAccounts(f.pool).FindPrincipal(ctx, 1); return err }},
		{"account profile", func() error { _, err := accountspg.NewAccounts(f.pool).ChatProfile(ctx, 1); return err }},
		{"account directory", func() error { _, err := accountspg.NewAccounts(f.pool).PublicNames(ctx, []int64{1}); return err }},
		{"publication permission", func() error { _, err := accountspg.NewAccounts(f.pool).PublicationProfile(ctx, 1, false); return err }},
		{"profile list", func() error { _, err := profilespg.NewCatalogue(f.pool).List(ctx, "", 1, 12); return err }},
		{"profile get", func() error { _, err := profilespg.NewCatalogue(f.pool).GetByNickname(ctx, "fixture01"); return err }},
		{"profile update", func() error {
			_, err := profilespg.NewCatalogue(f.pool).UpdateByUserID(ctx, 1, profilesdomain.UpdateInput{})
			return err
		}},
		{"profile media", func() error {
			_, err := profilespg.NewCatalogue(f.pool).MediaByNickname(ctx, "fixture01", false)
			return err
		}},
		{"profile owner", func() error { _, err := profilespg.NewCatalogue(f.pool).GetByUserID(ctx, 1); return err }},
		{"gallery list", func() error { _, err := gallerypg.NewStore(f.pool, nil, nil).List(ctx, 1); return err }},
		{"gallery add", func() error {
			_, err := gallerypg.NewStore(f.pool, nil, nil).Add(ctx, 1, gallerydomain.Upload{})
			return err
		}},
		{"gallery caption", func() error { err := gallerypg.NewStore(f.pool, nil, nil).Caption(ctx, 1, 1, "Caption"); return err }},
		{"gallery media", func() error { _, err := gallerypg.NewStore(f.pool, nil, nil).Media(ctx, 1, false); return err }},
		{"library list", func() error { _, _, err := librarypg.NewStore(f.pool, nil).List(ctx, 1, ""); return err }},
		{"library save", func() error {
			_, err := librarypg.NewStore(f.pool, nil).Save(ctx, 1, 0, librarydomain.Input{Title: "Title", Body: "Body"})
			return err
		}},
		{"emoji list", func() error { _, err := emojipg.NewStore(f.pool).List(ctx); return err }},
		{"emoji image", func() error { _, err := emojipg.NewStore(f.pool).Image(ctx, 1); return err }},
		{"emoji managed list", func() error { _, _, err := emojipg.NewStore(f.pool).Managed(ctx); return err }},
		{"emoji moderation", func() error { err := emojipg.NewStore(f.pool).Moderate(ctx, 1, emojidomain.Moderation{}); return err }},
		{"emoji deletion", func() error { err := emojipg.NewStore(f.pool).Delete(ctx, 1); return err }},
		{"emoji tag", func() error {
			_, err := emojipg.NewStore(f.pool).SaveTag(ctx, emojidomain.Tag{Name: "tag"})
			return err
		}},
		{"emoji managed image", func() error { _, err := emojipg.NewStore(f.pool).ManagedImage(ctx, 1); return err }},
		{"emoji upload", func() error {
			err := emojipg.NewStore(f.pool).Submit(ctx, emojis.Upload{UserID: 1, Code: "-test-"})
			return err
		}},
		{"chart list", func() error { _, err := chartpg.NewStore(f.pool).List(ctx, 1); return err }},
		{"chart audio", func() error { _, err := chartpg.NewStore(f.pool).Audio(ctx, 1); return err }},
		{"chart upload", func() error { err := chartpg.NewStore(f.pool).Add(ctx, 1, "Song", chartdomain.Audio{}); return err }},
		{"session start", func() error {
			_, err := chatpg.NewStore(f.pool).Start(ctx, chatdomain.Session{}, "secret", nil)
			return err
		}},
		{"session restore", func() error {
			_, err := chatpg.NewStore(f.pool).Restore(ctx, "session", "guest:1", "secret", time.Now(), time.Now(), time.Now())
			return err
		}},
		{"session activate", func() error {
			_, err := chatpg.NewStore(f.pool).Activate(ctx, "session", "guest:1", 1, time.Now(), time.Now(), time.Now())
			return err
		}},
		{"bot exchange", func() error {
			_, err := botpg.NewStore(f.pool, 1000, 180).Exchange(ctx, botdomain.Request{}, nil, nil)
			return err
		}},
		{"bot usage", func() error { _, err := botpg.NewStore(f.pool, 1000, 180).ReadBudget(ctx, time.Now()); return err }},
		{"bot spending", func() error { err := botpg.NewStore(f.pool, 1000, 180).Spend(ctx, nil); return err }},
		{"feedback", func() error { err := feedbackpg.NewStore(f.pool).Save(ctx, feedbackdomain.Entry{}); return err }},
		{"karma eligibility", func() error { _, err := karmikpg.NewStore(f.pool).Eligible(ctx, 1, 1); return err }},
		{"karma recording", func() error {
			err := karmikpg.NewStore(f.pool).Record(ctx, karmikdomain.Message{}, karmikdomain.Assessment{}, 1)
			return err
		}},
		{"session touch", func() error {
			err := chatpg.NewStore(f.pool).Touch(ctx, "session", "guest:1", 1, "unknown", time.Now(), time.Now(), time.Now())
			return err
		}},
		{"session identity", func() error {
			_, err := chatpg.NewStore(f.pool).RegisterIdentity(ctx, "session", "guest:1", 1, 1, "secret", time.Now())
			return err
		}},
		{"session stale", func() error {
			_, err := chatpg.NewStore(f.pool).MarkStale(ctx, time.Now(), time.Minute, time.Minute, time.Minute)
			return err
		}},
		{"session expired", func() error { _, err := chatpg.NewStore(f.pool).Expired(ctx, time.Now()); return err }},
		{"session end", func() error {
			_, err := chatpg.NewStore(f.pool).End(ctx, "session", "guest:1", 1, time.Now())
			return err
		}},
		{"session presence", func() error { _, err := chatpg.NewStore(f.pool).Presence(ctx, "lobby"); return err }},
		{"session reservation", func() error { _, err := chatpg.NewStore(f.pool).ReserveNickname(ctx, "Guest"); return err }},
		{"session auth", func() error {
			_, err := chatpg.NewStore(f.pool).Authenticate(ctx, "session", "guest:1", "secret", 1)
			return err
		}},
		{"visit history", func() error { _, err := chatpg.NewStore(f.pool).RecentVisits(ctx, time.Now()); return err }},
	}
	for _, check := range checks {
		t.Run(check.name, func(t *testing.T) {
			if err := check.call(); err == nil {
				t.Fatal("cancelled request succeeded")
			}
		})
	}
}
