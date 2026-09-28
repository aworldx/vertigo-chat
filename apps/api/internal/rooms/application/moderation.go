package application

import "context"

type Moderation struct {
	actions Actions
	admin   func(context.Context, int64) (bool, error)
}

func NewModeration(actions Actions, admin func(context.Context, int64) (bool, error)) Moderation {
	return Moderation{actions, admin}
}
func (m Moderation) Delete(ctx context.Context, actor int64, room string, id int64) error {
	allowed, err := m.admin(ctx, actor)
	if err != nil {
		return err
	}
	return m.actions.Delete(ctx, room, id, allowed)
}
