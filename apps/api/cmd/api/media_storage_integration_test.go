package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	botdomain "chat/api/internal/bot/domain"
	emojipg "chat/api/internal/emojis/adapters/postgres"
	gallerypg "chat/api/internal/gallery/adapters/postgres"
	gallerydomain "chat/api/internal/gallery/domain"
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"strings"
	"testing"
)

type galleryStorage struct {
	fail   string
	writes []string
}

func (s *galleryStorage) Save(_ context.Context, m gallerydomain.Media, field string) (gallerydomain.Media, error) {
	s.writes = append(s.writes, field)
	if s.fail == field {
		return gallerydomain.Media{}, errors.New("storage offline")
	}
	return gallerydomain.Media{Key: "remote/" + field, ContentType: m.ContentType}, nil
}
func (s *galleryStorage) Load(_ context.Context, key string) ([]byte, error) {
	if s.fail == "load" {
		return nil, errors.New("storage offline")
	}
	return []byte(key), nil
}
func (f *chatFixture) remoteGallery(t *testing.T) {
	ctx := context.Background()
	var user int64
	if err := f.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname='fixture13'`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	gate := func(context.Context, pgx.Tx, int64) (bool, error) { return true, nil }
	input := gallerydomain.Upload{Caption: "Remote", Image: gallerydomain.Media{Bytes: []byte("image"), ContentType: "image/png"}, Thumbnail: gallerydomain.Media{Bytes: []byte("thumbnail"), ContentType: "image/webp"}}
	for _, field := range []string{"image", "thumbnail"} {
		storage := &galleryStorage{fail: field}
		store := gallerypg.NewStore(f.pool, gate, storage)
		if _, err := store.Add(ctx, user, input); err == nil {
			t.Fatal("failed storage accepted")
		}
	}
	storage := &galleryStorage{}
	store := gallerypg.NewStore(f.pool, gate, storage)
	id, err := store.Add(ctx, user, input)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := f.pool.Exec(context.Background(), `DELETE FROM gallery_photos WHERE id=$1`, id); err != nil {
			t.Error(err)
		}
	})
	for _, thumbnail := range []bool{false, true} {
		m, err := store.Media(ctx, id, thumbnail)
		want := "remote/image"
		if thumbnail {
			want = "remote/thumbnail"
		}
		if err != nil || string(m.Bytes) != want {
			t.Fatal(m, err)
		}
	}
	storage.fail = "load"
	if _, err := store.Media(ctx, id, false); err == nil {
		t.Fatal("failed remote read accepted")
	}
	if _, err := gallerypg.NewStore(f.pool, gate, nil).Media(ctx, id, false); err == nil {
		t.Fatal("remote media without storage accepted")
	}
	if _, err := store.Media(ctx, 999999999, false); !errors.Is(err, gallerydomain.ErrNotFound) {
		t.Fatal(err)
	}
	if err := store.Caption(ctx, user, 999999999, "missing"); !errors.Is(err, gallerydomain.ErrNotFound) {
		t.Fatal(err)
	}
}
func (f *chatFixture) publicEmojiImage(t *testing.T) {
	ctx := context.Background()
	var id int64
	if err := f.pool.QueryRow(ctx, `INSERT INTO emojis(code,status,image,content_type,width,height,inserted_at,updated_at) VALUES('-coverage-image-','approved',$1,'image/png',32,32,NOW(),NOW()) RETURNING id`, []byte("image")).Scan(&id); err != nil {
		t.Fatal(err)
	}
	image, err := emojipg.NewStore(f.pool).Image(ctx, id)
	if err != nil || string(image.Bytes) != "image" {
		t.Fatal(image, err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE emojis SET status='rejected' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := emojipg.NewStore(f.pool).Image(ctx, id); err == nil {
		t.Fatal("rejected emoji exposed")
	}
}
func (f *chatFixture) botFailureRecovery(t *testing.T) {
	ctx := context.Background()
	store := botpg.NewStore(f.pool, 0, 10000).WithWarningPercent(-1)
	if _, err := f.pool.Exec(ctx, `TRUNCATE bot_daily_usages,bot_request_receipts,bot_conversations CASCADE`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name                        string
		result                      botdomain.Result
		providerError, publishError error
		wantError                   bool
	}{
		{name: "provider failure", providerError: botdomain.ErrUnavailable, wantError: true},
		{name: "invalid usage", result: botdomain.Result{Text: "Reply", Total: -1}, wantError: true},
		{name: "publish failure", result: botdomain.Result{Text: "Reply", Total: 1}, publishError: errors.New("room offline"), wantError: true},
		{name: "fallback", result: botdomain.Result{Text: "Fallback", Fallback: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := botdomain.Request{ID: tc.name, Identity: "guest:recovery", Nickname: "Guest", Body: "Hello"}
			published := 0
			generate := func(botdomain.Context) (botdomain.Result, error) { return tc.result, tc.providerError }
			_, err := store.Exchange(ctx, request, generate, func(botdomain.Result) error { published++; return tc.publishError })
			if (err != nil) != tc.wantError {
				t.Fatal(err)
			}
			if tc.providerError != nil && published != 0 {
				t.Fatal("provider error published")
			}
			if !tc.wantError {
				if _, err := store.Exchange(ctx, request, func(botdomain.Context) (botdomain.Result, error) {
					t.Fatal("replay spent tokens")
					return botdomain.Result{}, nil
				}, func(botdomain.Result) error { return nil }); err == nil {
					t.Fatal("duplicate request accepted")
				}
			}
		})
	}
	for i := 0; i < 12; i++ {
		_, err := store.Exchange(ctx, botdomain.Request{ID: fmt.Sprintf("summary-%d", i), Identity: "guest:summary-errors", Nickname: "Guest", Body: "Hello"}, func(input botdomain.Context) (botdomain.Result, error) {
			if input.Summarize {
				if i < 6 {
					return botdomain.Result{}, errors.New("summary offline")
				}
				return botdomain.Result{Text: strings.Repeat("я", 800), Total: 1}, nil
			}
			return botdomain.Result{Text: "Reply", Total: 1}, nil
		}, func(botdomain.Result) error { return nil })
		if err != nil {
			t.Fatal(err)
		}
	}
	var summary string
	if err := f.pool.QueryRow(ctx, `SELECT summary FROM bot_conversations WHERE subject_key='guest:summary-errors'`).Scan(&summary); err != nil || len([]rune(summary)) != 700 {
		t.Fatal(len([]rune(summary)), err)
	}
}
