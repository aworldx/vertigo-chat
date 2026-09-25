// Package application coordinates account and chat entrance in one unit of work.
package application

import (
	accountdomain "chat/api/internal/accounts/domain"
	sessions "chat/api/internal/chatsessions/domain"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidNickname = errors.New("invalid nickname")
var ErrNicknameOnline = errors.New("nickname online")
var nicknamePattern = regexp.MustCompile(`^[\p{L}\p{N}_-]{3,24}$`)

type Accounts interface {
	AuthorizeEntrance(context.Context, string, string) (accountdomain.Principal, error)
	Register(context.Context, string, string, string, string) (accountdomain.Principal, error)
	Issue(context.Context, string, int64, time.Time) (string, time.Time, error)
}
type Sessions interface {
	Start(context.Context, sessions.Start) (sessions.Session, string, error)
}
type UnitOfWork func(context.Context, string, func(Accounts, Sessions) error) error
type Service struct{ work UnitOfWork }

func NewService(work UnitOfWork) Service { return Service{work: work} }

type Input struct {
	Nickname, Password, Email, NetworkIdentity, PreviousAccountToken string
	Register                                                         bool
}
type Result struct {
	Session                    sessions.Session
	ResumeSecret, AccountToken string
	AccountExpires             time.Time
}

func (s Service) Enter(ctx context.Context, input Input) (Result, error) {
	input.Nickname = strings.TrimSpace(input.Nickname)
	if !nicknamePattern.MatchString(input.Nickname) {
		return Result{}, ErrInvalidNickname
	}
	if strings.EqualFold(input.Nickname, "Хичкок") || strings.EqualFold(input.Nickname, "Клэр") {
		return Result{}, ErrNicknameOnline
	}
	var result Result
	err := s.work(ctx, input.Nickname, func(accounts Accounts, chat Sessions) error {
		principal, err := authorize(ctx, accounts, input)
		if err != nil {
			return err
		}
		identity, err := identityKey(principal.UserID)
		if err != nil {
			return err
		}
		var userID *int64
		if principal.UserID > 0 {
			userID = &principal.UserID
		}
		result.Session, result.ResumeSecret, err = chat.Start(ctx, sessions.Start{RoomID: "lobby", Nickname: input.Nickname, IdentityKey: identity, UserID: userID})
		if err != nil {
			return err
		}
		if userID != nil {
			result.AccountToken, result.AccountExpires, err = accounts.Issue(ctx, input.PreviousAccountToken, *userID, time.Now())
		}
		return err
	})
	if err != nil {
		return Result{}, err
	}
	return result, nil
}
func authorize(ctx context.Context, accounts Accounts, input Input) (accountdomain.Principal, error) {
	if input.Register {
		return accounts.Register(ctx, input.Nickname, input.Email, input.Password, input.NetworkIdentity)
	}
	return accounts.AuthorizeEntrance(ctx, input.Nickname, input.Password)
}
func identityKey(userID int64) (string, error) {
	if userID > 0 {
		return "user:" + strconv.FormatInt(userID, 10), nil
	}
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "guest:" + hex.EncodeToString(bytes), nil
}
