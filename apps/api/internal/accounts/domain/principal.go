// Package domain contains identity types without HTTP or database dependencies.
package domain

// Principal is the authenticated identity available to application use cases.
type Principal struct {
	UserID            int64
	Nickname          string
	Admin             bool
	CanModerateEmojis bool
}

func (p Principal) HasRole(role string) bool {
	switch role {
	case "admin":
		return p.Admin
	case "emoji_moderator":
		return p.Admin || p.CanModerateEmojis
	default:
		return false
	}
}
