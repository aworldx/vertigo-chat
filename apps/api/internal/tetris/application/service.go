package application

import (
	"chat/api/internal/tetris/domain"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"log/slog"
	"strings"
	"sync"
	"time"
)

type Result struct {
	ID, Mode   string
	FinishedAt time.Time
	Players    []ResultPlayer
}
type ResultPlayer struct {
	UserID                     int64
	Nickname                   string
	Score, Lines, Level, Place int
}
type Leader struct {
	Nickname                           string
	Rating                             float64
	Score, Lines, Level, Matches, Wins int
	AchievedAt                         time.Time
}
type Results interface {
	Save(context.Context, Result) error
	Leaders(context.Context, string, string) ([]Leader, error)
}
type Invitation struct {
	ID, Code, Room, Host, Status string
	Players                      []string
}
type Invitations interface {
	Publish(context.Context, Invitation) error
}
type entry struct {
	match                  *domain.Match
	rematch                string
	invitationDirty, saved bool
}
type Service struct {
	mu          sync.Mutex
	games       map[string]*entry
	results     Results
	invitations Invitations
}

func NewService(results Results, invitations Invitations) *Service {
	return &Service{games: map[string]*entry{}, results: results, invitations: invitations}
}

func (s *Service) Create(ctx context.Context, a domain.Actor, solo bool) (*domain.Match, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e := s.active(a.Key); e != nil {
		return clone(e.match), nil
	}
	return s.create(ctx, a, solo)
}
func (s *Service) active(key string) *entry {
	for _, e := range s.games {
		if e.match.Player(key) != nil && e.match.Status != "finished" && e.match.Status != "cancelled" {
			return e
		}
	}
	return nil
}
func (s *Service) create(ctx context.Context, a domain.Actor, solo bool) (*domain.Match, error) {
	for _, e := range s.games {
		if e.match.Host == a.Key && e.match.Status == "cancelled" && time.Since(e.match.CreatedAt) < 10*time.Second {
			return nil, domain.ErrLimit
		}
	}
	if len(s.games) >= 1000 {
		return nil, domain.ErrLimit
	}
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return nil, err
	}
	id := hex.EncodeToString(bytes)
	code := s.code(bytes)
	m := domain.NewMatch(id, code, a, solo, binary.LittleEndian.Uint32(bytes[:4]), time.Now())
	if !solo {
		if err := s.invitations.Publish(ctx, invitation(m)); err != nil {
			return nil, err
		}
	}
	s.games[id] = &entry{match: m}
	return clone(m), nil
}
func (s *Service) code(bytes []byte) string {
	words := []string{"ЛИСА", "КЕДР", "ЛУНА", "СОВА", "МОРЕ", "ЛЕТО", "СНЕГ", "НЕБО", "МАЯК", "ВОЛК", "ТИГР", "ИРИС", "КОТ", "РЕКА", "УТРО", "ПОЛЕ"}
	start := int(binary.LittleEndian.Uint16(bytes[:2])) % (len(words) * 100)
	for step := 0; step < len(words)*100; step++ {
		n := (start + step) % (len(words) * 100)
		code := words[n/100] + "-" + string(rune('0'+(n%100)/10)) + string(rune('0'+n%10))
		exists := false
		for _, e := range s.games {
			if e.match.Code == code {
				exists = true
				break
			}
		}
		if !exists {
			return code
		}
	}
	return "ИГРА-" + hex.EncodeToString(bytes[:4])
}
func (s *Service) find(id string) *entry {
	if e := s.games[id]; e != nil {
		return e
	}
	for _, e := range s.games {
		if e.match.Code == strings.ToUpper(strings.TrimSpace(id)) {
			return e
		}
	}
	return nil
}
func (s *Service) View(a domain.Actor, id string, touch bool) (*domain.Match, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.find(id)
	if e == nil {
		return nil, domain.ErrNotFound
	}
	if !e.match.Access(a) {
		return nil, domain.ErrForbidden
	}
	if touch {
		if p := e.match.Player(a.Key); p != nil {
			p.LastSeen = time.Now()
		}
	}
	return clone(e.match), nil
}
func (s *Service) Command(a domain.Actor, id, action string, seq int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.find(id)
	if e == nil {
		return domain.ErrNotFound
	}
	m := e.match
	if !m.Access(a) {
		return domain.ErrForbidden
	}
	var err error
	before := m.Status
	now := time.Now()
	switch action {
	case "join":
		if other := s.active(a.Key); other != nil && other != e {
			return domain.ErrLimit
		}
		err = m.Join(a, now)
	case "ready":
		err = m.Ready(a.Key, true)
	case "unready":
		err = m.Ready(a.Key, false)
	case "start":
		err = m.Start(a.Key, now)
	case "leave":
		m.Leave(a.Key, now)
	default:
		err = m.Input(a.Key, action, seq, now)
	}
	if err == nil && (action == "join" || action == "leave" || action == "start" || before != m.Status) {
		e.invitationDirty = true
	}
	return err
}

// Run advances all games at a fixed step. Network clients never supply elapsed time or scores.
// One API process owns active matches; a process restart cancels those matches without ranking them.
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	go s.persist(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			s.mu.Lock()
			for id, e := range s.games {
				before := e.match.Status
				revision := e.match.Revision
				e.match.Tick(50, now)
				if before != e.match.Status || (before == "lobby" && revision != e.match.Revision) {
					e.invitationDirty = true
				}
				if !e.match.FinishedAt.IsZero() && now.Sub(e.match.FinishedAt) > time.Hour && e.saved {
					delete(s.games, id)
				}
			}
			s.mu.Unlock()
		}
	}
}
func (s *Service) persist(ctx context.Context) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.flush(ctx)
		}
	}
}
func (s *Service) flush(ctx context.Context) {
	// Persistence happens outside the game lock so a slow database cannot freeze input.
	type pending struct {
		id        string
		invite    *Invitation
		result    *Result
		cancelled bool
	}
	jobs := []pending{}
	s.mu.Lock()
	for id, e := range s.games {
		job := pending{id: id}
		if e.invitationDirty && e.match.Mode == "versus" {
			i := invitation(e.match)
			job.invite = &i
			e.invitationDirty = false
		}
		if !e.saved && e.match.Status == "finished" {
			r := result(e.match)
			job.result = &r
		}
		job.cancelled = e.match.Status == "cancelled"
		if job.invite != nil || job.result != nil || job.cancelled {
			jobs = append(jobs, job)
		}
	}
	s.mu.Unlock()
	for _, job := range jobs {
		inviteOK, saveOK := s.save(ctx, job.invite, job.result)
		s.mu.Lock()
		if e := s.games[job.id]; e != nil {
			if !inviteOK {
				e.invitationDirty = true
			}
			if saveOK || job.cancelled {
				e.saved = true
			}
		}
		s.mu.Unlock()
	}
}
func (s *Service) save(ctx context.Context, invite *Invitation, result *Result) (bool, bool) {
	work, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	inviteOK, saveOK := true, false
	if invite != nil {
		if err := s.invitations.Publish(work, *invite); err != nil {
			inviteOK = false
			slog.Error("save tetris invitation", "error", err)
		}
	}
	if result != nil {
		if err := s.results.Save(work, *result); err != nil {
			slog.Error("save tetris result", "error", err)
		} else {
			saveOK = true
		}
	}
	return inviteOK, saveOK
}
func (s *Service) Rematch(ctx context.Context, a domain.Actor, id string) (*domain.Match, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	previous := s.find(id)
	if previous == nil {
		return nil, domain.ErrNotFound
	}
	if !previous.match.Access(a) || previous.match.Player(a.Key) == nil {
		return nil, domain.ErrForbidden
	}
	if previous.match.Status != "finished" {
		return nil, domain.ErrInvalid
	}
	if next := s.games[previous.rematch]; next != nil {
		return clone(next.match), nil
	}
	if active := s.active(a.Key); active != nil {
		return nil, domain.ErrLimit
	}
	next, err := s.create(ctx, a, previous.match.Mode == "solo")
	if err != nil {
		return nil, err
	}
	current := s.games[next.ID]
	if next.Mode == "versus" {
		for _, p := range previous.match.Players {
			if p.Actor.Key != a.Key && s.active(p.Actor.Key) == nil {
				_ = current.match.Join(p.Actor, time.Now())
			}
		}
		current.invitationDirty = true
	}
	previous.rematch = next.ID
	return clone(current.match), nil
}
func (s *Service) Leaders(ctx context.Context, mode, period string) ([]Leader, error) {
	if mode != "solo" && mode != "versus" {
		return nil, domain.ErrInvalid
	}
	if period != "all" && period != "month" {
		return nil, domain.ErrInvalid
	}
	return s.results.Leaders(ctx, mode, period)
}
func invitation(m *domain.Match) Invitation {
	names := []string{}
	host := ""
	for _, p := range m.Players {
		names = append(names, p.Actor.Nickname)
		if p.Actor.Key == m.Host {
			host = p.Actor.Nickname
		}
	}
	return Invitation{ID: m.ID, Code: m.Code, Room: m.Room, Host: host, Status: m.Status, Players: names}
}
func result(m *domain.Match) Result {
	r := Result{ID: m.ID, Mode: m.Mode, FinishedAt: m.FinishedAt}
	for _, p := range m.Players {
		r.Players = append(r.Players, ResultPlayer{UserID: p.Actor.UserID, Nickname: p.Actor.Nickname, Score: p.Board.Score, Lines: p.Board.Lines, Level: p.Board.Level(), Place: m.Place(p)})
	}
	return r
}
func clone(m *domain.Match) *domain.Match {
	copy := *m
	copy.Players = make([]*domain.Player, 0, len(m.Players))
	for _, p := range m.Players {
		cp := *p
		cp.Pending = append([]domain.Pending{}, p.Pending...)
		cp.Board.Next = append([]int{}, p.Board.Next...)
		cp.Board.Bag = append([]int{}, p.Board.Bag...)
		copy.Players = append(copy.Players, &cp)
	}
	return &copy
}
