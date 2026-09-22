package application

import "context"

type ProgressWriter interface {
	IncrementPublicMessages(context.Context, int64) error
}
type Progress struct{ writer ProgressWriter }

func NewProgress(writer ProgressWriter) Progress { return Progress{writer} }
func (p Progress) RecordMessage(ctx context.Context, userID int64) error {
	if userID <= 0 {
		return nil
	}
	return p.writer.IncrementPublicMessages(ctx, userID)
}
