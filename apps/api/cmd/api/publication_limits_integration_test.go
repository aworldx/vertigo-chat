package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	gallerypg "chat/api/internal/gallery/adapters/postgres"
	gallery "chat/api/internal/gallery/application"
	gallerydomain "chat/api/internal/gallery/domain"
	librarypg "chat/api/internal/library/adapters/postgres"
	library "chat/api/internal/library/application"
	librarydomain "chat/api/internal/library/domain"
	chartpg "chat/api/internal/musicchart/adapters/postgres"
	chart "chat/api/internal/musicchart/application"
	chartdomain "chat/api/internal/musicchart/domain"
	profiles "chat/api/internal/profiles/application"
	"chat/api/migrations"
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"testing"
)

func TestPublicationLimitsPostgres(t *testing.T) {
	url := os.Getenv("GO_COMMUNITY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("isolated database required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrations.Apply(ctx, db); err != nil {
		t.Fatal(err)
	}
	var user int64
	if err := db.QueryRow(ctx, `INSERT INTO registered_users(nickname,password_hash,is_game_guest,theme_id,public_message_count,chat_seconds,inserted_at,updated_at) VALUES($1,'hash',false,1,0,0,NOW(),NOW()) RETURNING id`, fmt.Sprintf("rank-limits-%d", os.Getpid())).Scan(&user); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = db.Exec(ctx, `DELETE FROM registered_users WHERE id=$1`, user) }()
	people := accounts.NewDirectory(accountspg.NewAccounts(db))
	photos := gallery.NewService(gallerypg.NewStore(db, galleryUploadGate, nil), galleryPeople{people})
	articles := library.NewService(librarypg.NewStore(db, libraryGate), libraryPeople{people})
	tracks := chart.NewService(chartpg.NewStore(db, chartGate))
	cases := []struct {
		name, table string
		limitError  error
		add         func() error
	}{
		{"photos", "gallery_photos", gallerydomain.ErrTotal, func() error {
			_, err := photos.Add(ctx, user, gallery.Upload{Image: gallery.Media{Bytes: []byte{137, 80, 78, 71, 13, 10, 26, 10}, ContentType: "image/png"}})
			return err
		}},
		{"articles", "library_articles", librarydomain.ErrTotal, func() error {
			_, err := articles.Save(ctx, user, 0, library.Input{Title: "Article", Body: "Body"})
			return err
		}},
		{"tracks", "music_chart_tracks", chartdomain.ErrLimit, func() error {
			return tracks.Add(ctx, user, "Track", chartdomain.Audio{Bytes: []byte("ID3-test"), ContentType: "audio/mpeg"})
		}},
	}
	previous := 0
	for _, rank := range profiles.RankDefinitions() {
		if _, err := db.Exec(ctx, `UPDATE registered_users SET public_message_count=$2,chat_seconds=$3 WHERE id=$1`, user, rank.Messages, rank.Hours*3600); err != nil {
			t.Fatal(err)
		}
		for _, tc := range cases {
			t.Run(rank.Title+"/"+tc.name, func(t *testing.T) {
				// All additions happen today. Higher ranks immediately unlock capacity.
				for count := previous; count < rank.Limits.Tracks-1; count++ {
					if err := tc.add(); err != nil {
						t.Fatal(err)
					}
				}
				assertConcurrentRankLimit(t, tc.add, tc.limitError)
				var count int
				if err := db.QueryRow(ctx, `SELECT count(*) FROM `+tc.table+` WHERE user_id=$1`, user).Scan(&count); err != nil || count != rank.Limits.Tracks {
					t.Fatal(count, err)
				}
			})
		}
		previous = rank.Limits.Tracks
	}
	// Downgrading does not delete or hide items, and edits remain available above quota.
	if _, err := db.Exec(ctx, `UPDATE registered_users SET public_message_count=0,chat_seconds=0 WHERE id=$1`, user); err != nil {
		t.Fatal(err)
	}
	for _, tc := range cases {
		if err := tc.add(); !errors.Is(err, tc.limitError) {
			t.Fatal(tc.name, err)
		}
	}
	assertExistingPublications(t, ctx, user, photos, articles, tracks)
}

func assertConcurrentRankLimit(t *testing.T, add func() error, limitError error) {
	t.Helper()
	var wg sync.WaitGroup
	results := make(chan error, 4)
	for range 4 {
		wg.Add(1)
		go func() { defer wg.Done(); results <- add() }()
	}
	wg.Wait()
	close(results)
	accepted, rejected := 0, 0
	for err := range results {
		switch {
		case err == nil:
			accepted++
		case errors.Is(err, limitError):
			rejected++
		default:
			t.Fatal(err)
		}
	}
	if accepted != 1 || rejected != 3 {
		t.Fatal("concurrent limit bypass", accepted, rejected)
	}
}

func assertExistingPublications(t *testing.T, ctx context.Context, user int64, photos gallery.Service, articles library.Service, tracks chart.Service) {
	t.Helper()
	p, _, _, err := photos.List(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	var id int64
	count := 0
	for _, item := range p {
		if item.UserID == user {
			count++
			id = item.ID
		}
	}
	if count != 50 {
		t.Fatal("photos lost", count)
	}
	if err := photos.Caption(ctx, user, id, "Updated"); err != nil {
		t.Fatal(err)
	}
	a, _, _, _, err := articles.List(ctx, user, 0, "", false)
	if err != nil {
		t.Fatal(err)
	}
	count = 0
	for _, item := range a {
		if item.UserID == user {
			count++
			id = item.ID
		}
	}
	if count != 50 {
		t.Fatal("articles lost", count)
	}
	if _, err := articles.Save(ctx, user, id, library.Input{Title: "Updated", Body: "Still editable"}); err != nil {
		t.Fatal(err)
	}
	assertExistingTracks(t, ctx, user, tracks)
}

func assertExistingTracks(t *testing.T, ctx context.Context, user int64, tracks chart.Service) {
	t.Helper()
	var id int64
	tr, err := tracks.List(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, item := range tr {
		if item.Own {
			count++
			id = item.ID
		}
	}
	if count != 50 {
		t.Fatal("tracks lost", count)
	}
	if err := tracks.Rename(ctx, user, id, "Updated"); err != nil {
		t.Fatal(err)
	}
}
