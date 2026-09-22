package application

import (
	"context"
	"errors"
	"time"
	"unicode/utf8"

	"chat/api/internal/profiles/domain"
)

var ErrInvalidProfile = errors.New("invalid profile")

type Updater interface {
	UpdateByUserID(context.Context, int64, domain.UpdateInput) (domain.Profile, error)
}

type Editor struct {
	repository Updater
}

func NewEditor(repository Updater) Editor { return Editor{repository: repository} }

func (e Editor) Update(ctx context.Context, actorID int64, input domain.UpdateInput) (domain.Profile, error) {
	if actorID < 1 || !valid(input) {
		return domain.Profile{}, ErrInvalidProfile
	}
	return e.repository.UpdateByUserID(ctx, actorID, input)
}

func valid(input domain.UpdateInput) bool {
	return validLength(input.Name, 80) && validLength(input.About, 1000) && validGender(input.Gender) && validBirthDate(input.BirthDate)
}

func validLength(field domain.StringField, limit int) bool {
	return !field.Set || field.Value == nil || utf8.RuneCountInString(*field.Value) <= limit
}

func validGender(field domain.StringField) bool {
	return !field.Set || field.Value == nil || *field.Value == "male" || *field.Value == "female" || *field.Value == "other"
}

func validBirthDate(field domain.StringField) bool {
	if !field.Set || field.Value == nil {
		return true
	}
	birthDate, err := time.Parse(time.DateOnly, *field.Value)
	return err == nil && !birthDate.After(time.Now().UTC())
}
