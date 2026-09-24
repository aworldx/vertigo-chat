package http

import (
	"chat/api/internal/emojis/application"
	"chat/api/internal/emojis/domain"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
)

type Manager struct {
	service    application.Management
	identity   func(*http.Request, bool) (int64, int)
	publicBase string
	names      func(context.Context, []int64) (map[int64]string, error)
}

func NewManager(s application.Management, i func(*http.Request, bool) (int64, int), base string, names func(context.Context, []int64) (map[int64]string, error)) Manager {
	return Manager{s, i, base, names}
}
func (m Manager) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/admin/emojis", m.list)
	mux.HandleFunc("POST /api/v1/admin/emojis", m.upload)
	mux.HandleFunc("PUT /api/v1/admin/emojis/{id}", m.moderate)
	mux.HandleFunc("DELETE /api/v1/admin/emojis/{id}", m.delete)
	mux.HandleFunc("GET /api/v1/admin/emojis/{id}/image", m.image)
	mux.HandleFunc("POST /api/v1/admin/emoji-tags", m.saveTag)
	mux.HandleFunc("PUT /api/v1/admin/emoji-tags/{id}", m.saveTag)
	mux.HandleFunc("DELETE /api/v1/admin/emoji-tags/{id}", m.deleteTag)
}

type managedDTO struct {
	Author      string  `json:"author"`
	ID          int64   `json:"id"`
	Code        string  `json:"code"`
	Status      string  `json:"status"`
	ContentType string  `json:"content_type"`
	Reason      string  `json:"rejection_reason"`
	Width       int     `json:"width"`
	Height      int     `json:"height"`
	Animated    bool    `json:"animated"`
	TagIDs      []int64 `json:"tag_ids"`
}
type tagDTO struct {
	ID       int64    `json:"id"`
	Name     string   `json:"name"`
	Triggers []string `json:"triggers"`
}

func (m Manager) list(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	emojis, tags, err := m.service.List(r.Context(), user)
	if err != nil {
		managementFailure(w, err)
		return
	}
	ids := []int64{}
	for _, e := range emojis {
		ids = append(ids, e.UserID)
	}
	names, err := m.names(r.Context(), ids)
	if err != nil {
		managementFailure(w, err)
		return
	}
	data := []managedDTO{}
	groups := []tagDTO{}
	for _, e := range emojis {
		data = append(data, managedDTO{names[e.UserID], e.ID, domain.NormalizeCode(e.Code), e.Status, e.ContentType, e.Reason, e.Width, e.Height, e.Animated, e.TagIDs})
	}
	for _, t := range tags {
		groups = append(groups, tagDTO{t.ID, t.Name, t.Triggers})
	}
	managementJSON(w, 200, map[string]any{"emojis": data, "tags": groups})
}
func (m Manager) actor(w http.ResponseWriter, r *http.Request) (int64, bool) {
	user, status := m.identity(r, r.Method != "GET")
	if status != 0 {
		managementJSON(w, status, map[string]string{"error": "forbidden"})
		return 0, false
	}
	return user, true
}
func (m Manager) moderate(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	var v struct {
		Code   string  `json:"code"`
		Status string  `json:"status"`
		Reason string  `json:"rejection_reason"`
		TagIDs []int64 `json:"tag_ids"`
	}
	if !managementDecode(w, r, &v) {
		return
	}
	err := m.service.Moderate(r.Context(), user, managementID(r), application.Moderation{Code: v.Code, Status: v.Status, Reason: v.Reason, TagIDs: v.TagIDs})
	managementResult(w, err)
}
func (m Manager) delete(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	managementResult(w, m.service.Delete(r.Context(), user, managementID(r)))
}
func (m Manager) saveTag(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	var v struct {
		Name     string   `json:"name"`
		Triggers []string `json:"triggers"`
	}
	if !managementDecode(w, r, &v) {
		return
	}
	id := int64(0)
	if r.Method == "PUT" {
		id = managementID(r)
		if id < 1 {
			managementFailure(w, domain.ErrNotFound)
			return
		}
	}
	id, err := m.service.SaveTag(r.Context(), user, application.Tag{ID: id, Name: v.Name, Triggers: v.Triggers})
	if err != nil {
		managementFailure(w, err)
		return
	}
	status := 200
	if r.Method == "POST" {
		status = 201
	}
	managementJSON(w, status, map[string]int64{"id": id})
}
func (m Manager) deleteTag(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	managementResult(w, m.service.DeleteTag(r.Context(), user, managementID(r)))
}
func (m Manager) upload(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 720000)
	if r.ParseMultipartForm(720000) != nil {
		managementFailure(w, domain.ErrInvalid)
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	file, header, err := r.FormFile("image")
	if err != nil {
		managementFailure(w, domain.ErrInvalid)
		return
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, 700001))
	if err != nil {
		managementFailure(w, domain.ErrInvalid)
		return
	}
	err = m.service.Upload(r.Context(), user, application.Upload{Code: r.FormValue("code"), Bytes: data, ContentType: header.Header.Get("Content-Type")})
	if err != nil {
		managementFailure(w, err)
		return
	}
	managementJSON(w, 201, map[string]bool{"ok": true})
}
func (m Manager) image(w http.ResponseWriter, r *http.Request) {
	user, ok := m.actor(w, r)
	if !ok {
		return
	}
	v, err := m.service.Image(r.Context(), user, managementID(r))
	if err != nil {
		managementFailure(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if len(v.Bytes) == 0 && v.Key != "" && m.publicBase != "" {
		http.Redirect(w, r, m.publicBase+"/"+escapeKey(v.Key), http.StatusFound)
		return
	}
	if len(v.Bytes) == 0 {
		managementFailure(w, domain.ErrUnavailable)
		return
	}
	w.Header().Set("Content-Type", v.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(v.Bytes)
}
func managementID(r *http.Request) int64 {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id
}
func managementDecode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 16000)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	var extra any
	if d.Decode(v) != nil || d.Decode(&extra) != io.EOF {
		managementFailure(w, domain.ErrInvalid)
		return false
	}
	return true
}
func managementResult(w http.ResponseWriter, err error) {
	if err != nil {
		managementFailure(w, err)
		return
	}
	managementJSON(w, 200, map[string]bool{"ok": true})
}
func managementFailure(w http.ResponseWriter, err error) {
	status, code := 503, "unavailable"
	if errors.Is(err, domain.ErrForbidden) {
		status, code = 403, "forbidden"
	}
	if errors.Is(err, domain.ErrNotFound) {
		status, code = 404, "not_found"
	}
	if errors.Is(err, domain.ErrInvalid) || errors.Is(err, application.ErrUpload) {
		status, code = 422, "invalid_input"
	}
	managementJSON(w, status, map[string]string{"error": code})
}
func managementJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
