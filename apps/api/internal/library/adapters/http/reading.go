package http

import (
	"chat/api/internal/library/domain"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 16000)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	var extra any
	return d.Decode(value) == nil && d.Decode(&extra) == io.EOF
}
func (h Handler) updateSeries(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, true)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return
	}
	var v struct {
		OriginalName string `json:"original_name"`
		Name         string `json:"name"`
		Description  string `json:"description"`
	}
	if !decode(w, r, &v) {
		failure(w, domain.ErrInvalid)
		return
	}
	if err := h.s.UpdateSeries(r.Context(), user, domain.SeriesInput{OriginalName: v.OriginalName, Name: v.Name, Description: v.Description}); err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]bool{"saved": true})
}
func (h Handler) reaction(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, true)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		failure(w, domain.ErrNotFound)
		return
	}
	var v struct {
		Active *bool `json:"active"`
	}
	if !decode(w, r, &v) || v.Active == nil {
		failure(w, domain.ErrInvalid)
		return
	}
	kind := "like"
	if strings.HasSuffix(r.URL.Path, "/bookmark") {
		kind = "bookmark"
	}
	if err := h.s.Reaction(r.Context(), user, id, kind, *v.Active); err != nil {
		failure(w, err)
		return
	}
	respond(w, 200, map[string]bool{"saved": true})
}
func (h Handler) upload(w http.ResponseWriter, r *http.Request) {
	user, status := h.identity(r, true)
	if status != 0 {
		respond(w, status, map[string]string{"error": "forbidden"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, domain.MaxImageBytes+10000)
	if r.ParseMultipartForm(domain.MaxImageBytes+10000) != nil {
		failure(w, domain.ErrImage)
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	file, _, err := r.FormFile("image")
	if err != nil {
		failure(w, domain.ErrImage)
		return
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, domain.MaxImageBytes+1))
	if err != nil {
		failure(w, domain.ErrImage)
		return
	}
	id, err := h.s.AddImage(r.Context(), user, domain.Image{Bytes: data})
	if err != nil {
		failure(w, err)
		return
	}
	respond(w, 201, map[string]string{"url": "/library/images/" + strconv.FormatInt(id, 10)})
}
func (h Handler) image(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		failure(w, domain.ErrNotFound)
		return
	}
	v, err := h.s.Image(r.Context(), id)
	if err != nil {
		failure(w, err)
		return
	}
	w.Header().Set("Content-Type", v.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	_, _ = w.Write(v.Bytes)
}
