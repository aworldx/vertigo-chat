package http

import (
	"chat/api/internal/tetris/domain"
	"context"
	"encoding/json"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"net/http"
	"time"
)

type command struct {
	Type     string `json:"type"`
	Token    string `json:"token"`
	Sequence int64  `json:"sequence"`
}

func (h *Handler) socket(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") != h.origin {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	authCtx, done := context.WithTimeout(ctx, 5*time.Second)
	var first command
	err = wsjson.Read(authCtx, conn, &first)
	done()
	if err != nil || first.Type != "auth" {
		return
	}
	a, err := h.authenticate(ctx, first.Token)
	if err != nil {
		_ = conn.Close(websocket.StatusPolicyViolation, "Войди в чат")
		return
	}
	game, err := h.service.View(a, r.PathValue("id"), false)
	if err != nil {
		_ = conn.Close(websocket.StatusPolicyViolation, "Игра недоступна")
		return
	}
	key := game.ID + ":" + a.Key
	h.mu.Lock()
	old := h.connections[key]
	h.connections[key] = conn
	h.mu.Unlock()
	if old != nil {
		_ = old.Close(websocket.StatusNormalClosure, "Открыта другая игровая вкладка")
	}
	defer func() {
		h.mu.Lock()
		if h.connections[key] == conn {
			delete(h.connections, key)
		}
		h.mu.Unlock()
	}()
	h.run(ctx, conn, a, game.ID, first.Token)
}
func commands(ctx context.Context, conn *websocket.Conn) <-chan command {
	ch := make(chan command)
	go func() {
		defer close(ch)
		for {
			var c command
			if wsjson.Read(ctx, conn, &c) != nil {
				return
			}
			select {
			case ch <- c:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch
}
func send(ctx context.Context, conn *websocket.Conn, value any) error {
	work, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return wsjson.Write(work, conn, value)
}
func (h *Handler) run(ctx context.Context, conn *websocket.Conn, a domain.Actor, id, token string) {
	incoming := commands(ctx, conn)
	ticks := time.NewTicker(50 * time.Millisecond)
	defer ticks.Stop()
	auth := time.NewTicker(10 * time.Second)
	defer auth.Stop()
	window, count := time.Now(), 0
	previous := ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-auth.C:
			ping, done := context.WithTimeout(ctx, 2*time.Second)
			err := conn.Ping(ping)
			done()
			if err != nil {
				return
			}
			if _, err := h.authenticate(ctx, token); err != nil {
				_ = conn.Close(websocket.StatusPolicyViolation, "Сессия чата завершена")
				return
			}
		case c, ok := <-incoming:
			if !ok {
				return
			}
			if time.Since(window) >= time.Second {
				window = time.Now()
				count = 0
			}
			count++
			if count > 40 {
				_ = conn.Close(websocket.StatusPolicyViolation, "Слишком много команд")
				return
			}
			if err := h.service.Command(a, id, c.Type, c.Sequence); err != nil {
				if send(ctx, conn, map[string]string{"type": "error", "message": actionError(err)}) != nil {
					return
				}
			}
		case <-ticks.C:
			if !h.pushState(ctx, conn, a, id, &previous) {
				return
			}

		}
	}
}
func (h *Handler) pushState(ctx context.Context, conn *websocket.Conn, a domain.Actor, id string, previous *string) bool {
	game, err := h.service.View(a, id, true)
	if err != nil {
		return false
	}
	encoded, _ := json.Marshal(encode(game, a))
	if string(encoded) != *previous {
		if send(ctx, conn, map[string]any{"type": "state", "game": json.RawMessage(encoded)}) != nil {
			return false
		}
		*previous = string(encoded)
	}
	return true
}
func actionError(err error) string {
	switch err {
	case domain.ErrFull:
		return "Набор закрыт. Ты можешь наблюдать."
	case domain.ErrForbidden:
		return "Только создатель может начать игру."
	case domain.ErrLimit:
		return "Сначала выйди из другой активной игры."
	default:
		return "Действие недоступно. Для старта все игроки должны быть готовы."
	}
}
