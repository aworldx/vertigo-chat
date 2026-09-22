package application

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"chat/api/internal/accounts/domain"
)

var ErrInvalidRegistration = errors.New("invalid registration")
var ErrRegistrationLimited = errors.New("registration limited")

var nicknamePattern = regexp.MustCompile(`^[\p{L}\p{N}_-]{3,24}$`)

type AccountCreator interface {
	Create(context.Context, string, string, string, string) (domain.Principal, error)
}

type PasswordHasher interface {
	Hash(string) (string, error)
}

type Registrar struct {
	creator AccountCreator
	hasher  PasswordHasher
}

func NewRegistrar(creator AccountCreator, hasher PasswordHasher) Registrar {
	return Registrar{creator: creator, hasher: hasher}
}

func (r Registrar) Register(ctx context.Context, nickname, email, password, networkIdentity string) (domain.Principal, error) {
	nickname = strings.TrimSpace(nickname)
	email = strings.ToLower(strings.TrimSpace(email))
	if networkIdentity == "" || !nicknamePattern.MatchString(nickname) || utf8.RuneCountInString(password) < 6 || utf8.RuneCountInString(password) > 128 || (email != "" && !validEmail(email)) {
		return domain.Principal{}, ErrInvalidRegistration
	}
	hash, err := r.hasher.Hash(password)
	if err != nil {
		return domain.Principal{}, err
	}
	return r.creator.Create(ctx, nickname, email, hash, networkIdentity)
}

func validEmail(email string) bool {
	return regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`).MatchString(email)
}
