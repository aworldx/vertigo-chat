package http

import (
	"chat/api/internal/emojis/application"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type Identity func(*http.Request, bool) (int64, int)
type UploadHandler struct {
	uploader application.Uploader
	identity Identity
}

func NewUploadHandler(u application.Uploader, i Identity) UploadHandler { return UploadHandler{u, i} }
func (h UploadHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/chat/emojis", h.upload)
}
func (h UploadHandler) upload(w http.ResponseWriter, r *http.Request) {
	id, status := h.identity(r, true)
	if status != 0 {
		http.Error(w, "forbidden", status)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 720000)
	if r.ParseMultipartForm(720000) != nil {
		http.Error(w, "invalid_upload", http.StatusUnprocessableEntity)
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "image_required", http.StatusUnprocessableEntity)
		return
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, 700001))
	if err != nil {
		http.Error(w, "invalid_upload", http.StatusUnprocessableEntity)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	err = h.uploader.Submit(ctx, application.Upload{UserID: id, Code: strings.TrimSpace(r.FormValue("code")), Bytes: data, ContentType: header.Header.Get("Content-Type")})
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err != nil {
		w.WriteHeader(422)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Не удалось загрузить смайлик. Проверь формат, размеры и свободный код."})
		return
	}
	w.WriteHeader(201)
	_, _ = w.Write([]byte(`{"data":{"status":"pending"}}`))
}
