package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"chat/api/internal/profiles/application"
	"chat/api/internal/profiles/domain"
)

type MutationHandler struct {
	editor      application.Editor
	photoEditor application.PhotoEditor
	account     application.AccountCatalog
	identity    func(*http.Request, bool) (int64, int)
}

func NewMutationHandler(editor application.Editor, photoEditor application.PhotoEditor, account application.AccountCatalog, identity func(*http.Request, bool) (int64, int)) MutationHandler {
	return MutationHandler{editor: editor, photoEditor: photoEditor, account: account, identity: identity}
}

func (h MutationHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/account/profile", h.current)
	mux.HandleFunc("PATCH /api/v1/account/profile", h.update)
	mux.HandleFunc("PUT /api/v1/account/profile/photo", h.updatePhoto)
}

func (h MutationHandler) updatePhoto(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1_500_001)
	if err := r.ParseMultipartForm(1_500_000); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo", "Фото должно быть JPG, PNG или WebP и не больше 1,5 МБ.")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()
	file, header, err := r.FormFile("photo")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo", "Выбери подходящее фото.")
		return
	}
	defer func() { _ = file.Close() }()
	bytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo", "Фото должно быть JPG, PNG или WebP и не больше 1,5 МБ.")
		return
	}
	profile, err := h.photoEditor.Update(r.Context(), userID, domain.PhotoInput{Bytes: bytes, ContentType: header.Header.Get("Content-Type")})
	if errors.Is(err, application.ErrInvalidPhoto) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo", "Фото должно быть JPG, PNG или WebP и не больше 1,5 МБ.")
		return
	}
	if errors.Is(err, application.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Анкета не найдена.")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadGateway, "unavailable", "Сервис анкет временно недоступен.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": profileDTO(profile)})
}

func (h MutationHandler) current(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	profile, err := h.account.Get(r.Context(), userID)
	if err != nil {
		writeCatalogError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": profileDTO(profile)})
}

func (h MutationHandler) authenticate(w http.ResponseWriter, r *http.Request) (int64, bool) {
	userID, status := h.identity(r, r.Method != http.MethodGet)
	if status == 0 && userID > 0 {
		return userID, true
	}
	if status == 0 {
		status = http.StatusUnauthorized
	}
	code := "unauthorized"
	if status == http.StatusForbidden {
		code = "forbidden"
	}
	if status == http.StatusServiceUnavailable {
		code = "unavailable"
	}
	writeError(w, status, code, "Не удалось подтвердить сессию. Войди на сайт ещё раз.")
	return 0, false
}

func (h MutationHandler) update(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	input, err := decodeUpdate(w, r)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_profile", "Проверь поля анкеты.")
		return
	}
	profile, err := h.editor.Update(r.Context(), userID, input)
	if errors.Is(err, application.ErrInvalidProfile) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_profile", "Проверь поля анкеты.")
		return
	}
	if errors.Is(err, application.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "Анкета не найдена.")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadGateway, "unavailable", "Сервис анкет временно недоступен.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": profileDTO(profile)})
}

func decodeUpdate(w http.ResponseWriter, r *http.Request) (domain.UpdateInput, error) {
	defer func() { _ = r.Body.Close() }()
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16*1024))
	decoder.DisallowUnknownFields()
	var body struct {
		Profile struct {
			Name      json.RawMessage `json:"name"`
			BirthDate json.RawMessage `json:"birth_date"`
			Gender    json.RawMessage `json:"gender"`
			About     json.RawMessage `json:"about"`
		} `json:"profile"`
	}
	if err := decoder.Decode(&body); err != nil {
		return domain.UpdateInput{}, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return domain.UpdateInput{}, errors.New("unexpected JSON")
	}
	name, err := decodeField(body.Profile.Name)
	if err != nil {
		return domain.UpdateInput{}, err
	}
	birthDate, err := decodeField(body.Profile.BirthDate)
	if err != nil {
		return domain.UpdateInput{}, err
	}
	gender, err := decodeField(body.Profile.Gender)
	if err != nil {
		return domain.UpdateInput{}, err
	}
	about, err := decodeField(body.Profile.About)
	if err != nil {
		return domain.UpdateInput{}, err
	}
	return domain.UpdateInput{Name: name, BirthDate: birthDate, Gender: gender, About: about}, nil
}

func decodeField(raw json.RawMessage) (domain.StringField, error) {
	if raw == nil {
		return domain.StringField{}, nil
	}
	if string(raw) == "null" {
		return domain.StringField{Set: true}, nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return domain.StringField{}, err
	}
	return domain.StringField{Set: true, Value: &value}, nil
}
