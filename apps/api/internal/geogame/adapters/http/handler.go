package http

import (
	"chat/api/internal/geogame/application"
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

type Authenticate func(context.Context, string) (domain.Actor, error)
type Handler struct {
	Service            application.Service
	Rankings           application.Rankings
	Authenticate       Authenticate
	Origin, BrowserKey string
}
type Snapshot struct {
	ID         string          `json:"id"`
	Phase      string          `json:"phase"`
	Round      int             `json:"round"`
	Total      int             `json:"total"`
	Deadline   time.Time       `json:"deadline"`
	ServerTime time.Time       `json:"server_time"`
	Cooldown   time.Time       `json:"cooldown"`
	Configured bool            `json:"configured"`
	BrowserKey string          `json:"browser_key,omitempty"`
	Scene      *Scene          `json:"scene,omitempty"`
	OwnAnswer  string          `json:"own_answer"`
	Answered   int             `json:"answered"`
	Solution   *Solution       `json:"solution,omitempty"`
	Leaders    []domain.Result `json:"leaders"`
}
type Scene struct {
	PanoID  string  `json:"pano_id"`
	Heading float64 `json:"heading"`
	Pitch   float64 `json:"pitch"`
}
type Solution struct {
	Country  string       `json:"country"`
	City     string       `json:"city"`
	Position domain.Point `json:"position"`
	Points   int          `json:"points"`
	Source   string       `json:"source"`
	Author   string       `json:"author"`
}

func (h Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/geo", h.view)
	mux.HandleFunc("GET /api/v1/geo/leaderboard", h.leaders)
	mux.HandleFunc("POST /api/v1/geo/start", h.start)
	mux.HandleFunc("PUT /api/v1/geo/answer", h.answer)
}
func (h Handler) actor(w http.ResponseWriter, r *http.Request) (domain.Actor, bool) {
	if r.Method != "GET" && r.Header.Get("Origin") != h.Origin {
		http.Error(w, "Недопустимый источник запроса.", http.StatusForbidden)
		return domain.Actor{}, false
	}
	a, err := h.Authenticate(r.Context(), r.Header.Get("X-Chat-Session"))
	if err != nil || a.Key == "" || a.Room == "" {
		http.Error(w, "Сначала войди в чат.", http.StatusUnauthorized)
		return a, false
	}
	return a, true
}
func (h Handler) view(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	g, err := h.Service.View(r.Context(), a)
	h.respond(w, g, a, err)
}
func (h Handler) start(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	g, err := h.Service.Start(r.Context(), a)
	h.respond(w, g, a, err)
}
func (h Handler) answer(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input struct {
		ID    string `json:"id"`
		Round int    `json:"round"`
		Text  string `json:"text"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(&input) != nil || d.Decode(new(json.RawMessage)) != io.EOF {
		h.respond(w, domain.Game{}, a, domain.ErrInvalid)
		return
	}
	g, err := h.Service.Answer(r.Context(), a, input.ID, input.Round, input.Text)
	h.respond(w, g, a, err)
}
func (h Handler) respond(w http.ResponseWriter, g domain.Game, a domain.Actor, err error) {
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(h.snapshot(g, a))
}
func (h Handler) snapshot(g domain.Game, a domain.Actor) Snapshot {
	phase := g.Phase
	if phase == "" {
		phase = "idle"
	}
	s := Snapshot{ID: g.ID, Phase: phase, Round: g.Round, Total: 5, Deadline: g.Deadline, ServerTime: h.Service.Now(), Cooldown: g.Cooldown, Configured: h.Service.Questions.Configured(), OwnAnswer: g.Answers[a.Key].Text, Answered: len(g.Answers), Leaders: g.Leaders()}
	if g.Phase == "active" || g.Phase == "reveal" {
		q := g.Questions[g.Round-1]
		s.BrowserKey = h.BrowserKey
		s.Scene = &Scene{PanoID: q.PanoID, Heading: q.Heading, Pitch: q.Pitch}
		if g.Phase == "reveal" {
			s.Solution = &Solution{Country: q.Place.Country, City: q.Place.City, Position: q.Position, Points: g.Answers[a.Key].Points, Source: q.Source, Author: q.Author}
		}
	}
	return s
}
func failure(w http.ResponseWriter, err error) {
	status, message := 503, "Не удалось подготовить места. Попробуйте позже."
	switch {
	case errors.Is(err, domain.ErrConflict):
		status, message = 409, "Раунд изменился. Обновляем игру…"
	case errors.Is(err, domain.ErrInvalid):
		status, message = 422, "Укажите страну или город, до 120 символов."
	case errors.Is(err, domain.ErrLimit):
		status, message = 429, "Подождите немного перед следующим действием."
	}
	http.Error(w, message, status)
}

func (h Handler) leaders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if h.Rankings == nil {
		failure(w, domain.ErrUnavailable)
		return
	}
	rows, err := h.Rankings.Leaders(r.Context())
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rows)
}
