package application

import (
	"chat/api/internal/tetris/domain"
	"context"
	"reflect"
	"testing"
	"time"
)

func TestReplayCommitsAtomicallyAndPreservesSeatPrivacy(t *testing.T) {
	s := NewService(&memoryResults{}, &memoryInvites{})
	a := domain.Actor{Key: "a", Room: "r"}
	game, err := s.Create(context.Background(), a, true)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.ClientClock(a, game.ID, true); err != nil {
		t.Fatal(err)
	}
	m := s.games[game.ID].match
	m.Status = "running"
	m.StartedAt = time.Now().Add(-time.Minute)
	before := clone(m)
	invalid := []domain.ReplayInput{{Type: "drop", Sequence: 1, PieceID: 1, At: 0}, {Type: "drop", Sequence: 3, PieceID: 2, At: 0}}
	if err = s.Replay(a, game.ID, 0, invalid); err == nil {
		t.Fatal("sequence gap accepted")
	}
	if !reflect.DeepEqual(s.games[game.ID].match, before) {
		t.Fatal("rejected batch partially changed game")
	}
	if err = s.Replay(domain.Actor{Key: "b", Room: "r"}, game.ID, 0, nil); err == nil {
		t.Fatal("private solo replay accepted")
	}
	if err = s.Replay(a, game.ID, 0, invalid[:1]); err != nil {
		t.Fatal(err)
	}
	if s.games[game.ID].match.Players[0].Board.Score == 0 {
		t.Fatal("server did not compute score")
	}
}
