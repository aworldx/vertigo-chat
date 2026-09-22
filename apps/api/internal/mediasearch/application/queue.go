package application

import (
	"context"
	"errors"
)

var ErrBusy = errors.New("media search queue full")

type searchResult struct {
	items []Item
	err   error
}
type searchJob struct {
	ctx         context.Context
	kind, query string
	reply       chan searchResult
}
type Queue struct {
	jobs chan searchJob
	done <-chan struct{}
}

func NewQueue(ctx context.Context, provider Provider) *Queue {
	q := &Queue{jobs: make(chan searchJob, 32), done: ctx.Done()}
	for range 2 {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case job := <-q.jobs:
					if job.ctx.Err() != nil {
						continue
					}
					items, err := provider.Search(job.ctx, job.kind, job.query)
					job.reply <- searchResult{items, err}
				}
			}
		}()
	}
	return q
}
func (q *Queue) Search(ctx context.Context, kind, query string) ([]Item, error) {
	job := searchJob{ctx, kind, query, make(chan searchResult, 1)}
	select {
	case <-q.done:
		return nil, context.Canceled
	case q.jobs <- job:
	default:
		return nil, ErrBusy
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-q.done:
		return nil, context.Canceled
	case result := <-job.reply:
		return result.items, result.err
	}
}
