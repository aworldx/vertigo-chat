package http

import (
	"chat/api/internal/bot/application"
	"chat/api/internal/bot/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

type limitsDTO struct {
	DailyTokens int `json:"daily_tokens"`
	StopPercent int `json:"stop_percent"`
}
type colorsDTO struct {
	Nickname string `json:"nickname_color"`
	Text     string `json:"text_color"`
}
type styleDTO struct {
	Dark      colorsDTO `json:"dark"`
	Light     colorsDTO `json:"light"`
	Font      string    `json:"font_id"`
	FontStyle string    `json:"font_style"`
}

func encodeStyle(v application.Style) styleDTO {
	return styleDTO{colorsDTO{v.Dark.Nickname, v.Dark.Text}, colorsDTO{v.Light.Nickname, v.Light.Text}, v.Font, v.FontStyle}
}
func (v styleDTO) style() application.Style {
	return application.Style{Dark: domain.Colors{Nickname: v.Dark.Nickname, Text: v.Dark.Text}, Light: domain.Colors{Nickname: v.Light.Nickname, Text: v.Light.Text}, Font: v.Font, FontStyle: v.FontStyle}
}

type botDTO struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Style styleDTO `json:"style"`
}
type overviewDTO struct {
	Limits        limitsDTO `json:"limits"`
	Used          int       `json:"used_tokens"`
	StopThreshold int       `json:"stop_threshold"`
	UTCOffset     int       `json:"utc_offset_minutes"`
	Bots          []botDTO  `json:"bots"`
}

func Register(mux *http.ServeMux, service application.Settings, identity func(*http.Request, bool) (int64, int), offset int) {
	handle := func(mutation bool, action func(context.Context, int64, http.ResponseWriter, *http.Request) error) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Robots-Tag", "noindex, nofollow")
			user, status := identity(r, mutation)
			if status != 0 {
				fail(w, status, "forbidden")
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
			defer cancel()
			if err := action(ctx, user, w, r); err != nil {
				writeError(w, err)
			}
		}
	}
	mux.HandleFunc("GET /api/v1/admin/bots", handle(false, func(ctx context.Context, user int64, w http.ResponseWriter, _ *http.Request) error {
		v, err := service.Read(ctx, user)
		if err != nil {
			return err
		}
		dto := overviewDTO{Limits: limitsDTO{v.Limits.DailyTokens, v.Limits.StopPercent}, Used: v.Budget.Used, StopThreshold: v.Budget.StopThreshold, UTCOffset: offset, Bots: []botDTO{}}
		for _, b := range v.Bots {
			dto.Bots = append(dto.Bots, botDTO{b.ID, b.Name, encodeStyle(b.Style)})
		}
		return json.NewEncoder(w).Encode(dto)
	}))
	mux.HandleFunc("PUT /api/v1/admin/bots/budget", handle(true, func(ctx context.Context, user int64, w http.ResponseWriter, r *http.Request) error {
		var v struct {
			DailyTokens *int `json:"daily_tokens"`
			StopPercent *int `json:"stop_percent"`
		}
		if err := decode(w, r, &v); err != nil {
			return err
		}
		if v.DailyTokens == nil || v.StopPercent == nil {
			return application.ErrInvalidSettings
		}
		if err := service.UpdateLimits(ctx, user, application.Limits{DailyTokens: *v.DailyTokens, StopPercent: *v.StopPercent}); err != nil {
			return err
		}
		return json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))
	mux.HandleFunc("PUT /api/v1/admin/bots/{id}/style", handle(true, func(ctx context.Context, user int64, w http.ResponseWriter, r *http.Request) error {
		var v styleDTO
		if err := decode(w, r, &v); err != nil {
			return err
		}
		if err := service.UpdateStyle(ctx, user, r.PathValue("id"), v.style()); err != nil {
			return err
		}
		return json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return application.ErrInvalidSettings
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return application.ErrInvalidSettings
	}
	return nil
}
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrForbidden):
		fail(w, 403, "forbidden")
	case errors.Is(err, application.ErrInvalidSettings):
		fail(w, 422, "invalid_settings")
	default:
		fail(w, 503, "unavailable")
	}
}
func fail(w http.ResponseWriter, status int, code string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code})
}
