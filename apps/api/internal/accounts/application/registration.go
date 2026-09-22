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

var nicknamePattern = regexp.MustCompile(`^[\p{L}\p{N}_-]{3,24}$`)

type AccountCreator interface {
	Create(context.Context, string, string, string) (domain.Principal, error)
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

func (r Registrar) Register(ctx context.Context, nickname, email, password string) (domain.Principal, error) {
	nickname = strings.TrimSpace(nickname)
	email = strings.ToLower(strings.TrimSpace(email))
	if !nicknamePattern.MatchString(nickname) || utf8.RuneCountInString(password) < 6 || utf8.RuneCountInString(password) > 128 || (email != "" && !validEmail(email)) {
		return domain.Principal{}, ErrInvalidRegistration
	}
	hash, err := r.hasher.Hash(password)
	if err != nil {
		return domain.Principal{}, err
	}
	return r.creator.Create(ctx, nickname, email, hash)
}

func validEmail(email string) bool {
	at := strings.LastIndex(email, "@")
	return at > 0 && at < len(email)-1 && strings.Contains(email[at+1:], ".") && !strings.ContainsAny(email, " \t\n")
}
