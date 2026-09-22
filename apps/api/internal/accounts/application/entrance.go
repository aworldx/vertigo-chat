package application

import (
	"chat/api/internal/accounts/domain"
	"context"
	"errors"
	"strings"
)

var ErrPasswordRequired = errors.New("password required")

// AuthorizeEntrance accepts an unregistered nickname as a guest only when the
// password is empty. Site-cookie authentication never silently joins the chat.
func (a Authenticator) AuthorizeEntrance(ctx context.Context, nickname, password string) (domain.Principal, error) {
	nickname = strings.TrimSpace(nickname)
	principal, hash, err := a.reader.FindByNickname(ctx, nickname)
	if errors.Is(err, ErrAccountNotFound) && password == "" {
		return domain.Principal{Nickname: nickname}, nil
	}
	if err != nil {
		return domain.Principal{}, err
	}
	if password == "" {
		return domain.Principal{}, ErrPasswordRequired
	}
	if len(password) > 512 || !a.verifier.Verify(password, hash) {
		return domain.Principal{}, ErrInvalidCredentials
	}
	return principal, nil
}
