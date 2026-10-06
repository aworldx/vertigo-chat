package domain

import (
	"errors"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

var (
	ErrUnavailable = errors.New("geo_unavailable")
	ErrConflict    = errors.New("geo_conflict")
	ErrInvalid     = errors.New("geo_invalid")
	ErrLimit       = errors.New("geo_limit")
)

type Actor struct {
	Key, Room, Nickname string
	Registered          bool
}
type Place struct {
	BuiltUp   bool     `json:"built_up"`
	Country   string   `json:"country"`
	City      string   `json:"city"`
	Countries []string `json:"countries"`
	Cities    []string `json:"cities"`
}
type Point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}
type Question struct {
	ID       string  `json:"id"`
	PanoID   string  `json:"pano_id"`
	Position Point   `json:"position"`
	Heading  float64 `json:"heading"`
	Pitch    float64 `json:"pitch"`
	Place    Place   `json:"place"`
	Source   string  `json:"source"`
	Author   string  `json:"author"`
}
type Award struct {
	GameID   string
	Round    int
	Identity string
	Nickname string
	Points   int
}
type Ranking struct {
	Nickname string `json:"nickname"`
	Points   int    `json:"points"`
	Rounds   int    `json:"rounds"`
}
type Answer struct {
	Registered bool      `json:"registered"`
	Nickname   string    `json:"nickname"`
	Text       string    `json:"text"`
	Points     int       `json:"points"`
	At         time.Time `json:"at"`
}
type Result struct {
	Nickname string `json:"nickname"`
	Points   int    `json:"points"`
}
type Game struct {
	Awards        []Award           `json:"-"`
	ID            string            `json:"id"`
	Phase         string            `json:"phase"`
	Round         int               `json:"round"`
	Deadline      time.Time         `json:"deadline"`
	Cooldown      time.Time         `json:"cooldown"`
	Questions     []Question        `json:"questions"`
	Answers       map[string]Answer `json:"answers"`
	Scores        map[string]Result `json:"scores"`
	RoundSeconds  int               `json:"round_seconds"`
	RevealSeconds int               `json:"reveal_seconds"`
}

func New(id string, now time.Time) Game {
	return Game{ID: id, Phase: "preparing", Deadline: now.Add(time.Minute), Cooldown: now.Add(time.Minute), Answers: map[string]Answer{}, Scores: map[string]Result{}, RoundSeconds: 300, RevealSeconds: 10}
}

func (g *Game) Ready(questions []Question, now time.Time) error {
	if len(questions) != 5 || g.Phase != "preparing" || !now.Before(g.Deadline) {
		return ErrUnavailable
	}
	seen := map[string]bool{}
	for _, q := range questions {
		if q.ID == "" || q.PanoID == "" || len(q.Place.Countries) == 0 || seen[q.ID] {
			return ErrInvalid
		}
		seen[q.ID] = true
	}
	g.Questions = questions
	g.Round = 1
	g.Phase = "active"
	g.Deadline = now.Add(time.Duration(g.RoundSeconds) * time.Second)
	return nil
}

// Advance uses absolute deadlines, so refresh, polling speed and API restarts
// cannot extend a round. Answers are scored once, only at its deadline.
func (g *Game) Advance(now time.Time) {
	for g.Phase != "" && !now.Before(g.Deadline) {
		switch g.Phase {
		case "preparing":
			g.Phase = "unavailable"
			return
		case "active":
			for key, a := range g.Answers {
				if a.Registered {
					g.Awards = append(g.Awards, Award{GameID: g.ID, Round: g.Round, Identity: key, Nickname: a.Nickname, Points: a.Points})
				}
				score := g.Scores[key]
				score.Nickname = a.Nickname
				score.Points += a.Points
				g.Scores[key] = score
			}
			g.Phase = "reveal"
			g.Deadline = g.Deadline.Add(time.Duration(g.RevealSeconds) * time.Second)
		case "reveal":
			if g.Round == len(g.Questions) {
				g.Phase = "finished"
				g.Questions = nil
				g.Answers = map[string]Answer{}
				g.Cooldown = g.Deadline.Add(30 * time.Second)
				g.Deadline = g.Deadline.Add(time.Hour)
			} else {
				g.Round++
				g.Phase = "active"
				g.Answers = map[string]Answer{}
				g.Deadline = g.Deadline.Add(time.Duration(g.RoundSeconds) * time.Second)
			}
		case "finished":
			*g = Game{Awards: g.Awards}
			return
		default:
			return
		}
	}
}

func (g *Game) CanAnswer(actor Actor, id string, round int, now time.Time) error {
	if g.ID != id || g.Round != round || g.Phase != "active" || !now.Before(g.Deadline) {
		return ErrConflict
	}
	if actor.Key == "" || actor.Nickname == "" {
		return ErrInvalid
	}
	if len(g.Answers) >= 500 {
		if _, ok := g.Answers[actor.Key]; !ok {
			return ErrLimit
		}
	}
	if last, ok := g.Answers[actor.Key]; ok && now.Sub(last.At) < time.Second {
		return ErrLimit
	}
	return nil
}

func (g *Game) Answer(actor Actor, id string, round int, text string, now time.Time) error {
	if err := g.CanAnswer(actor, id, round, now); err != nil {
		return err
	}
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > 120 {
		return ErrInvalid
	}
	q := g.Questions[g.Round-1]
	g.Answers[actor.Key] = Answer{Registered: actor.Registered, Nickname: actor.Nickname, Text: text, Points: q.Place.Score(text), At: now}
	return nil
}

func normalize(text string) string {
	text = strings.ToLower(strings.ReplaceAll(text, "ё", "е"))
	return strings.Join(strings.FieldsFunc(text, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }), " ")
}

func (p Place) Score(text string) int {
	answer := normalize(text)
	for _, city := range p.Cities {
		if answer == normalize(city) {
			return 3
		}
		for _, country := range p.Countries {
			if answer == normalize(country+" "+city) || answer == normalize(city+" "+country) {
				return 3
			}
		}
	}
	for _, country := range p.Countries {
		if answer == normalize(country) {
			return 1
		}
	}
	return 0
}

func (g Game) Leaders() []Result {
	result := make([]Result, 0, len(g.Scores))
	for _, r := range g.Scores {
		result = append(result, r)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Points == result[j].Points {
			return result[i].Nickname < result[j].Nickname
		}
		return result[i].Points > result[j].Points
	})
	return result
}
