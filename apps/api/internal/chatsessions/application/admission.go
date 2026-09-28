package application

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"errors"
	"time"
)

var ErrNicknameOccupied = errors.New("nickname occupied")

type AdmissionStore interface {
	LockNickname(context.Context, string) error
	SessionsForNickname(context.Context, string) ([]domain.Session, error)
}

// Admission must run in the entrance transaction, after account authentication.
// Registered owners replace old sessions atomically; guests cannot take a name.
type Admission struct {
	store     AdmissionStore
	lifecycle Service
}

func NewAdmission(store AdmissionStore, lifecycle Service) Admission {
	return Admission{store, lifecycle}
}
func (a Admission) Start(ctx context.Context, start domain.Start) (domain.Session, string, error) {
	if err := a.store.LockNickname(ctx, start.Nickname); err != nil {
		return domain.Session{}, "", err
	}
	sessions, err := a.store.SessionsForNickname(ctx, start.Nickname)
	if err != nil {
		return domain.Session{}, "", err
	}
	if len(sessions) > 0 && (start.UserID == nil || *start.UserID <= 0) {
		return domain.Session{}, "", ErrNicknameOccupied
	}
	for _, session := range sessions {
		if _, err := a.lifecycle.End(ctx, session.ID, session.IdentityKey, session.Generation, time.Now()); err != nil {
			return domain.Session{}, "", err
		}
	}
	return a.lifecycle.Start(ctx, start)
}
