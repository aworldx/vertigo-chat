package http

import (
	"chat/api/internal/tetris/application"
	"chat/api/internal/tetris/domain"
	"context"
	"encoding/json"
	"errors"
	"github.com/coder/websocket"
	"math"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Authenticate func(context.Context, string) (domain.Actor, error)
type Handler struct {
	service      *application.Service
	authenticate Authenticate
	origin       string
	mu           sync.Mutex
	connections  map[string]*websocket.Conn
}

func NewHandler(s *application.Service, a Authenticate, origin string) *Handler {
	return &Handler{service: s, authenticate: a, origin: origin, connections: map[string]*websocket.Conn{}}
}
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/tetris", h.create)
	mux.HandleFunc("POST /api/v1/tetris/{id}/rematch", h.rematch)
	mux.HandleFunc("GET /api/v1/tetris/leaderboard", h.leaders)
	mux.HandleFunc("GET /api/v1/tetris/{id}", h.get)
	mux.HandleFunc("GET /api/v1/tetris/{id}/socket", h.socket)
}
func (h *Handler) actor(w http.ResponseWriter, r *http.Request) (domain.Actor, bool) {
	if r.Method != "GET" && r.Header.Get("Origin") != h.origin {
		http.Error(w, "Недопустимый источник запроса.", http.StatusForbidden)
		return domain.Actor{}, false
	}
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	a, err := h.authenticate(r.Context(), token)
	if err != nil {
		http.Error(w, "Сначала войди в чат.", http.StatusUnauthorized)
		return a, false
	}
	return a, true
}
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	var input struct {
		Mode string `json:"mode"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 512)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(&input) != nil || (input.Mode != "solo" && input.Mode != "versus") {
		failure(w, domain.ErrInvalid)
		return
	}
	game, err := h.service.Create(r.Context(), a, input.Mode == "solo")
	if err != nil {
		failure(w, err)
		return
	}
	write(w, encode(game, a))
}
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	game, err := h.service.View(a, r.PathValue("id"), false)
	if err != nil {
		failure(w, err)
		return
	}
	write(w, encode(game, a))
}

type leaderDTO struct {
	Nickname   string    `json:"nickname"`
	Rating     int       `json:"rating"`
	Score      int       `json:"score"`
	Lines      int       `json:"lines"`
	Level      int       `json:"level"`
	Matches    int       `json:"matches"`
	Wins       int       `json:"wins"`
	AchievedAt time.Time `json:"achieved_at"`
}

func (h *Handler) leaders(w http.ResponseWriter, r *http.Request) {
	mode, period := r.URL.Query().Get("mode"), r.URL.Query().Get("period")
	if mode == "" {
		mode = "versus"
	}
	if period == "" {
		period = "all"
	}
	rows, err := h.service.Leaders(r.Context(), mode, period)
	if err != nil {
		failure(w, err)
		return
	}
	result := []leaderDTO{}
	for _, row := range rows {
		result = append(result, leaderDTO{Nickname: row.Nickname, Rating: int(math.Round(row.Rating)), Score: row.Score, Lines: row.Lines, Level: row.Level, Matches: row.Matches, Wins: row.Wins, AchievedAt: row.AchievedAt})
	}
	write(w, result)
}
func write(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(value)
}
func failure(w http.ResponseWriter, err error) {
	status, message := 503, "Игра временно недоступна. Попробуй ещё раз."
	switch {
	case errors.Is(err, domain.ErrInvalid):
		status, message = 422, "Действие недоступно. Проверь готовность игроков."
	case errors.Is(err, domain.ErrForbidden):
		status, message = 403, "Нет доступа к этой игре."
	case errors.Is(err, domain.ErrNotFound):
		status, message = 404, "Игра завершена или не найдена."
	case errors.Is(err, domain.ErrFull):
		status, message = 409, "Набор закрыт. Можно наблюдать."
	case errors.Is(err, domain.ErrLimit):
		status, message = 429, "Уже есть активная игра или превышен лимит."
	}
	http.Error(w, message, status)
}

func (h *Handler) rematch(w http.ResponseWriter, r *http.Request) {
	a, ok := h.actor(w, r)
	if !ok {
		return
	}
	game, err := h.service.Rematch(r.Context(), a, r.PathValue("id"))
	if err != nil {
		failure(w, err)
		return
	}
	write(w, encode(game, a))
}
