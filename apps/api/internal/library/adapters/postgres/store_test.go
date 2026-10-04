package postgres

import (
	"chat/api/internal/library/domain"
	"chat/api/migrations"
	"context"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"testing"
)

func TestLibraryReadingPostgres(t *testing.T) {
	url := os.Getenv("GO_LIBRARY_TEST_DATABASE_URL")
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
	var users [2]int64
	for i := range users {
		if err := db.QueryRow(ctx, `INSERT INTO registered_users(nickname,password_hash,is_game_guest,theme_id,public_message_count,inserted_at,updated_at) VALUES($1,'hash',false,1,0,NOW(),NOW()) RETURNING id`, fmt.Sprintf("library-reader-%d-%d", os.Getpid(), i)).Scan(&users[i]); err != nil {
			t.Fatal(err)
		}
	}
	defer func() { _, _ = db.Exec(ctx, `DELETE FROM registered_users WHERE id=ANY($1)`, users[:]) }()
	s := NewStore(db, func(context.Context, pgx.Tx, int64) (bool, error) { return true, nil })
	first, err := s.Save(ctx, users[0], 0, domain.Input{Title: "First", Body: "Body", Series: "Old"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.Save(ctx, users[0], 0, domain.Input{Title: "Second", Body: "Body", Series: "Old"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Save(ctx, users[1], 0, domain.Input{Title: "Other", Body: "Body", Series: "Old"}); err != nil {
		t.Fatal(err)
	}
	testSeries(t, s, ctx, users, first, second)
	testReactions(t, s, ctx, users, first)
	testImageCovers(t, s, ctx, users, first)
	testImageQuota(t, s, db, ctx, users[0])
}
func testSeries(t *testing.T, s Store, ctx context.Context, users [2]int64, first, second int64) {
	t.Helper()
	if err := s.UpdateSeries(ctx, users[0], domain.SeriesInput{OriginalName: "Old", Name: "New", Description: "About the whole series"}); err != nil {
		t.Fatal(err)
	}
	list, groups, err := s.List(ctx, users[0], users[0], "New", false)
	if err != nil || len(list) != 2 || list[0].ID != first || list[1].ID != second {
		t.Fatal(list, err)
	}
	assertSeriesDescription(t, groups, users[0])
	others, _, err := s.List(ctx, users[1], users[1], "Old", false)
	if err != nil || len(others) != 1 {
		t.Fatal(others, err)
	}
	if err := s.UpdateSeries(ctx, users[1], domain.SeriesInput{OriginalName: "New", Name: "Stolen"}); err != domain.ErrNotFound {
		t.Fatal(err)
	}
	if _, err := s.Save(ctx, users[0], 0, domain.Input{Title: "Conflict", Body: "Body", Series: "Taken"}); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateSeries(ctx, users[0], domain.SeriesInput{OriginalName: "New", Name: "Taken"}); err != domain.ErrSeriesConflict {
		t.Fatal(err)
	}
}
func testReactions(t *testing.T, s Store, ctx context.Context, users [2]int64, id int64) {
	t.Helper()
	var wg sync.WaitGroup
	for range 6 {
		wg.Go(func() {
			if err := s.Reaction(ctx, users[0], id, "like", true); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if err := s.Reaction(ctx, users[0], id, "bookmark", true); err != nil {
		t.Fatal(err)
	}
	mine, _, err := s.List(ctx, users[0], 0, "", true)
	if err != nil || len(mine) != 1 || mine[0].ID != id || mine[0].Likes != 1 || !mine[0].Liked || !mine[0].Bookmarked {
		t.Fatal(mine, err)
	}
	private, _, err := s.List(ctx, users[1], 0, "", true)
	if err != nil || len(private) != 0 {
		t.Fatal(private, err)
	}
	testReactionRemoval(t, s, ctx, users, id)
}
func testReactionRemoval(t *testing.T, s Store, ctx context.Context, users [2]int64, id int64) {
	t.Helper()
	public, _, err := s.List(ctx, 0, 0, "", false)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range public {
		if a.Liked || a.Bookmarked {
			t.Fatal(a)
		}
	}
	for _, kind := range []string{"like", "bookmark"} {
		for range 2 {
			if err := s.Reaction(ctx, users[0], id, kind, false); err != nil {
				t.Fatal(err)
			}
		}
	}
	mine, _, err := s.List(ctx, users[0], 0, "", true)
	if err != nil || len(mine) != 0 {
		t.Fatal(mine, err)
	}
	if err := s.Reaction(ctx, users[0], 99999999, "like", true); err != domain.ErrNotFound {
		t.Fatal(err)
	}
}
func testImageCovers(t *testing.T, s Store, ctx context.Context, users [2]int64, id int64) {
	t.Helper()
	imageID, err := s.AddImage(ctx, users[0], domain.Image{Bytes: []byte{1, 2, 3}, ContentType: "image/png"})
	if err != nil {
		t.Fatal(err)
	}
	cover := fmt.Sprintf("/library/images/%d", imageID)
	input := domain.Input{Title: "Cover", Body: "Body", CoverImage: &cover}
	if _, err := s.Save(ctx, users[1], 0, input); err != domain.ErrInvalid {
		t.Fatal(err)
	}
	if _, err := s.Save(ctx, users[0], id, input); err != nil {
		t.Fatal(err)
	}
	testCoverChanges(t, s, ctx, users[0], id, input, cover)
	media, err := s.Image(ctx, imageID)
	if err != nil || len(media.Bytes) != 3 || media.ContentType != "image/png" {
		t.Fatal(media, err)
	}
}
func testCoverChanges(t *testing.T, s Store, ctx context.Context, user, id int64, input domain.Input, cover string) {
	t.Helper()
	input.CoverImage = nil
	if _, err := s.Save(ctx, user, id, input); err != nil {
		t.Fatal(err)
	}
	list, _, err := s.List(ctx, user, 0, "", false)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range list {
		if a.ID == id && a.CoverImage != cover {
			t.Fatal(a)
		}
	}
	empty := ""
	input.CoverImage = &empty
	if _, err := s.Save(ctx, user, id, input); err != nil {
		t.Fatal(err)
	}
	list, _, err = s.List(ctx, user, 0, "", false)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range list {
		if a.ID == id && a.CoverImage != "" {
			t.Fatal(a)
		}
	}

}

func assertSeriesDescription(t *testing.T, groups []domain.Series, user int64) {
	t.Helper()
	for _, g := range groups {
		if g.UserID == user && g.Name == "New" && g.Description == "About the whole series" {
			return
		}
	}
	t.Fatal(groups)
}

func testImageQuota(t *testing.T, s Store, db *pgxpool.Pool, ctx context.Context, user int64) {
	t.Helper()
	if _, err := db.Exec(ctx, `INSERT INTO library_images(user_id,image,content_type) SELECT $1,decode('01','hex'),'image/png' FROM generate_series(1,29)`, user); err != nil {
		t.Fatal(err)
	}
	v := domain.Image{Bytes: []byte{1}, ContentType: "image/png"}
	if _, err := s.AddImage(ctx, user, v); err != domain.ErrImageQuota {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `UPDATE library_images SET inserted_at=now()-INTERVAL '2 days' WHERE user_id=$1`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddImage(ctx, user, v); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO library_images(user_id,image,content_type,inserted_at) SELECT $1,decode('01','hex'),'image/png',now()-INTERVAL '2 days' FROM generate_series(1,169)`, user); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddImage(ctx, user, v); err != domain.ErrImageQuota {
		t.Fatal(err)
	}
}
