package application

import (
	"chat/api/internal/emojis/domain"
	"context"
	"testing"
)

func TestManagementDeniesEveryOperationBeforeStorage(t *testing.T) {
	m := NewManagement(nil, func(context.Context, int64) (bool, error) { return false, nil }, Uploader{})
	ctx := context.Background()
	_, _, list := m.List(ctx, 1)
	_, tag := m.SaveTag(ctx, 1, Tag{})
	_, image := m.Image(ctx, 1, 1)
	for name, err := range map[string]error{"list": list, "tag": tag, "image": image, "moderate": m.Moderate(ctx, 1, 1, Moderation{}), "delete": m.Delete(ctx, 1, 1), "delete tag": m.DeleteTag(ctx, 1, 1), "upload": m.Upload(ctx, 1, Upload{})} {
		if err != domain.ErrForbidden {
			t.Fatalf("%s: %v", name, err)
		}
	}
}
