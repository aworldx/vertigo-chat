package postgres

import (
	"chat/api/internal/rooms/domain"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"regexp"
	"strings"
)

type Database interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db} }

const columns = `id,COALESCE(client_id,''),kind,author,body,sent_at,appearance,font_id,font_style,reactions,COALESCE(recipient,''),COALESCE(media_url,''),COALESCE(media_artist,''),COALESCE(media_duration,''),COALESCE(media_source_url,'')`

func (s Store) Send(ctx context.Context, author domain.Author, clientID, body string) (domain.Message, error) {
	var message domain.Message
	var appearance, reactions []byte

	var limited bool
	err := s.db.QueryRow(ctx, `SELECT NOT EXISTS(SELECT 1 FROM room_messages WHERE room_id=$1 AND author_identity=$2 AND client_id=$3) AND (count(*) FILTER (WHERE sent_at>(NOW() AT TIME ZONE 'UTC')-interval '2 seconds')>=3 OR count(*)>=12) FROM room_messages WHERE room_id=$1 AND author_identity=$2 AND kind IN ('text','gif','music','youtube') AND sent_at>(NOW() AT TIME ZONE 'UTC')-interval '1 minute'`, author.RoomID, author.Identity, clientID).Scan(&limited)
	if err != nil {
		return message, err
	}
	if limited {
		return message, domain.ErrRateLimited
	}
	storedAppearance := []byte(`{}`)
	if author.Appearance != nil {
		storedAppearance, err = json.Marshal(author.Appearance)
		if err != nil {
			return message, err
		}
	}
	font, style := author.FontID, author.FontStyle
	if font == "" {
		font = "theme"
	}
	if style == "" {
		style = "normal"
	}
	// Conflict returns the original body. Replayed outbox IDs never edit history.
	err = s.db.QueryRow(ctx, `INSERT INTO room_messages(room_id,kind,author,body,client_id,author_identity,theme_id,appearance,reactions,font_id,font_style,recipient,sent_at,inserted_at,updated_at) VALUES($1,'text',$2,$3,$4,$5,'vertigo',$6,'{}',$7,$8,NULLIF($9,''),(NOW() AT TIME ZONE 'UTC'),(NOW() AT TIME ZONE 'UTC'),(NOW() AT TIME ZONE 'UTC')) ON CONFLICT(room_id,author_identity,client_id) WHERE client_id IS NOT NULL DO UPDATE SET client_id=room_messages.client_id RETURNING `+columns+`,(xmax=0)`, author.RoomID, author.Nickname, body, clientID, author.Identity, storedAppearance, font, style, author.Recipient).Scan(&message.ID, &message.ClientID, &message.Kind, &message.Author, &message.Body, &message.SentAt, &appearance, &message.FontID, &message.FontStyle, &reactions, &message.Recipient, &message.MediaURL, &message.Artist, &message.Duration, &message.SourceURL, &message.Inserted)
	_ = json.Unmarshal(reactions, &message.Reactions)
	message.Appearance = decodeAppearance(appearance)
	normalizeTypography(&message)
	return message, err
}
func (s Store) Recent(ctx context.Context, roomID string) ([]domain.Message, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM (SELECT * FROM room_messages WHERE room_id=$1 ORDER BY id DESC LIMIT 30) messages ORDER BY id`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := make([]domain.Message, 0, 30)
	for rows.Next() {
		var m domain.Message
		var appearance, reactions []byte
		if err := rows.Scan(&m.ID, &m.ClientID, &m.Kind, &m.Author, &m.Body, &m.SentAt, &appearance, &m.FontID, &m.FontStyle, &reactions, &m.Recipient, &m.MediaURL, &m.Artist, &m.Duration, &m.SourceURL); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(reactions, &m.Reactions)
		m.Appearance = decodeAppearance(appearance)
		normalizeTypography(&m)
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func decodeAppearance(raw []byte) domain.Appearance {
	var stored map[string]map[string]string
	// message_frame is a viewer preference, not a property of the message.
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(raw, &fields)
	stored = make(map[string]map[string]string)
	for _, mode := range []string{"dark", "light"} {
		var colors map[string]string
		_ = json.Unmarshal(fields[mode], &colors)
		stored[mode] = colors
	}
	color := func(mode, field, fallback string) string {
		value := stored[mode][field]
		if colorPattern.MatchString(value) {
			return strings.ToLower(value)
		}
		return fallback
	}
	return domain.Appearance{
		Dark:  domain.Colors{Nickname: color("dark", "nickname_color", "#fcd34d"), Text: color("dark", "text_color", "#e4e4e7")},
		Light: domain.Colors{Nickname: color("light", "nickname_color", "#9a3412"), Text: color("light", "text_color", "#1f2937")},
	}
}
func normalizeTypography(message *domain.Message) {
	switch message.FontID {
	case "sans", "display", "serif":
	default:
		message.FontID = "theme"
	}
	if message.FontStyle != "italic" {
		message.FontStyle = "normal"
	}
}
