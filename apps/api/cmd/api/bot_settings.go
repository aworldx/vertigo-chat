package main

import (
	botpg "chat/api/internal/bot/adapters/postgres"
	bot "chat/api/internal/bot/application"
	chatlans "chat/api/internal/chatlans/application"
	chathttp "chat/api/internal/chatsessions/adapters/http"
	profilespg "chat/api/internal/profiles/adapters/postgres"
	profiles "chat/api/internal/profiles/application"
	roomdomain "chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
	"strings"
)

func botStore(pool *pgxpool.Pool) botpg.Store {
	limit, _ := strconv.Atoi(env("OPENAI_BOT_DAILY_TOKEN_LIMIT", "120000"))
	percent, _ := strconv.Atoi(env("OPENAI_BOT_TOKEN_WARNING_PERCENT", "90"))
	return botpg.NewStore(pool, limit, botUTCOffset()).WithWarningPercent(percent)
}
func botAuthor(ctx context.Context, pool *pgxpool.Pool, author roomdomain.Author) (roomdomain.Author, error) {
	style, err := bot.NewStyles(botStore(pool)).Read(ctx, strings.TrimPrefix(author.Identity, "bot:"))
	if err != nil {
		return author, err
	}
	author.Appearance = &roomdomain.Appearance{Dark: roomdomain.Colors{Nickname: style.Dark.Nickname, Text: style.Dark.Text}, Light: roomdomain.Colors{Nickname: style.Light.Nickname, Text: style.Light.Text}}
	author.FontID, author.FontStyle = style.Font, style.FontStyle
	return author, nil
}
func botPreferences(pool *pgxpool.Pool) func(context.Context, string) (chatlans.Preferences, error) {
	styles := bot.NewStyles(botStore(pool))
	return func(ctx context.Context, id string) (chatlans.Preferences, error) {
		p := chatlans.Default()
		v, err := styles.Read(ctx, id)
		p.Appearance.Dark.Nickname, p.Appearance.Dark.Text = v.Dark.Nickname, v.Dark.Text
		p.Appearance.Light.Nickname, p.Appearance.Light.Text = v.Light.Nickname, v.Light.Text
		p.Font, p.Style = v.Font, v.FontStyle
		return p, err
	}
}

// Bot ranks use the same profile counters and rank rules as human participants.
func botPresentation(pool *pgxpool.Pool) func(context.Context, string) (chathttp.Presentation, error) {
	preferences := botPreferences(pool)
	catalogue := profiles.NewCatalog(profilespg.NewCatalogue(pool))
	return func(ctx context.Context, id string) (chathttp.Presentation, error) {
		p, err := preferences(ctx, id)
		result := chathttp.Presentation{Preferences: p}
		if err != nil {
			return result, err
		}
		name := "Хичкок"
		if id == "claire" {
			name = "Клэр"
		}
		profile, err := catalogue.Get(ctx, name)
		if err != nil {
			return result, err
		}
		title, icon := profiles.Rank(profile.PublicMessageCount, profile.ChatSeconds)
		result.Rank = &chathttp.Rank{Title: title, Icon: "/images/ranks/" + icon + ".svg"}
		return result, nil
	}
}
