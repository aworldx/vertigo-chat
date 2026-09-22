package main

import (
	accountspg "chat/api/internal/accounts/adapters/postgres"
	accounts "chat/api/internal/accounts/application"
	chatlanpg "chat/api/internal/chatlans/adapters/postgres"
	chatlans "chat/api/internal/chatlans/application"
	chathttp "chat/api/internal/chatsessions/adapters/http"
	chatspg "chat/api/internal/chatsessions/adapters/postgres"
	chats "chat/api/internal/chatsessions/application"
	chatdomain "chat/api/internal/chatsessions/domain"
	profiles "chat/api/internal/profiles/application"
	roompg "chat/api/internal/rooms/adapters/postgres"
	rooms "chat/api/internal/rooms/application"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
	"strings"
	"time"
)

type participantPreferences struct {
	guests   chatlans.Store
	accounts accounts.PreferencesService
}

func (p participantPreferences) Get(ctx context.Context, identity string) (chatlans.Preferences, error) {
	if !strings.HasPrefix(identity, "user:") {
		return p.guests.Get(ctx, identity)
	}
	id, err := strconv.ParseInt(strings.TrimPrefix(identity, "user:"), 10, 64)
	if err != nil {
		return chatlans.Preferences{}, err
	}
	account, err := p.accounts.Get(ctx, id)
	if err != nil {
		return chatlans.Preferences{}, err
	}
	var preferences chatlans.Preferences
	err = json.Unmarshal(account.Preferences, &preferences)
	return preferences, err
}
func (p participantPreferences) Put(ctx context.Context, identity string, preferences chatlans.Preferences) error {
	if !strings.HasPrefix(identity, "user:") {
		return p.guests.Put(ctx, identity, preferences)
	}
	id, err := strconv.ParseInt(strings.TrimPrefix(identity, "user:"), 10, 64)
	if err != nil {
		return err
	}
	raw, err := json.Marshal(preferences)
	if err != nil {
		return err
	}
	return p.accounts.Save(ctx, id, raw)
}
func preferencesService(db interface {
	chatlanpg.Database
	accountspg.Database
}) chatlans.Service {
	return chatlans.NewService(participantPreferences{chatlanpg.NewStore(db), accounts.NewPreferences(accountspg.NewAccounts(db))})
}
func roomExperience(pool *pgxpool.Pool) chathttp.Experience {
	reply, available := botReplies(pool)
	return chathttp.Experience{Bot: reply, BotAvailable: available, Media: sendRoomMedia(pool),
		React: func(ctx context.Context, session chatdomain.Session, id int64, emoji string, active bool) error {
			return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
				if err := chats.NewService(chatspg.NewStore(tx), chatsessionsPolicy()).Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
					return err
				}
				return rooms.NewActions(roompg.NewStore(tx)).React(ctx, session.RoomID, id, session.IdentityKey, session.Nickname, emoji, active)
			})
		},
		Delete: func(ctx context.Context, session chatdomain.Session, id int64) error {
			return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
				if err := chats.NewService(chatspg.NewStore(tx), chatsessionsPolicy()).Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
					return err
				}
				if !strings.HasPrefix(session.IdentityKey, "user:") {
					return rooms.ErrActionDenied
				}
				userID, err := strconv.ParseInt(strings.TrimPrefix(session.IdentityKey, "user:"), 10, 64)
				if err != nil {
					return err
				}
				account, err := accounts.NewPreferences(accountspg.NewAccounts(tx)).Get(ctx, userID)
				if err != nil {
					return err
				}
				return rooms.NewActions(roompg.NewStore(tx)).Delete(ctx, session.RoomID, id, account.Admin)
			})
		},
		Present: func(ctx context.Context, session chatdomain.Session) (chathttp.Presentation, error) {
			preferences, err := preferencesService(pool).Get(ctx, session.IdentityKey)
			p := chathttp.Presentation{Preferences: preferences}
			if err != nil {
				return p, err
			}
			if strings.HasPrefix(session.IdentityKey, "user:") {
				id, err := strconv.ParseInt(strings.TrimPrefix(session.IdentityKey, "user:"), 10, 64)
				if err != nil {
					return p, err
				}
				account, err := accounts.NewPreferences(accountspg.NewAccounts(pool)).Get(ctx, id)
				if err != nil {
					return p, err
				}
				title, icon := profiles.Rank(account.PublicMessages, account.ChatSeconds)
				p.Rank = &chathttp.Rank{Title: title, Icon: "/images/ranks/" + icon + ".svg"}
				p.Admin = account.Admin
				p.Karma = account.Karma
			}
			return p, nil
		},
		Save: func(ctx context.Context, session chatdomain.Session, preferences chatlans.Preferences) (chatlans.Preferences, error) {
			var saved chatlans.Preferences
			err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
				if err := chats.NewService(chatspg.NewStore(tx), chatsessionsPolicy()).Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()); err != nil {
					return err
				}
				var err error
				saved, err = preferencesService(tx).Save(ctx, session.IdentityKey, preferences)
				return err
			})
			return saved, err
		},
	}
}
