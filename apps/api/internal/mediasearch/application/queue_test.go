package application

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"testing/synctest"
)

type providerFunc func(context.Context, string, string) ([]Item, error)

func (f providerFunc) Search(ctx context.Context, kind, query string) ([]Item, error) {
	return f(ctx, kind, query)
}
func TestQueueDeliversResultAndPropagatesCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		q := NewQueue(ctx, providerFunc(func(_ context.Context, kind, query string) ([]Item, error) {
			return []Item{{Kind: kind, Title: query}}, nil
		}))
		items, err := q.Search(ctx, "gif", "cat")
		if err != nil || len(items) != 1 || items[0].Title != "cat" {
			t.Fatal(items, err)
		}
		cancel()
		synctest.Wait()
		if _, err = q.Search(ctx, "gif", "cat"); !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	})
}
func TestQueueBoundsPendingWorkAndSkipsCancelledJobs(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		var calls atomic.Int32
		provider := providerFunc(func(job context.Context, _, _ string) ([]Item, error) {
			calls.Add(1)
			<-job.Done()
			return nil, job.Err()
		})
		q := NewQueue(ctx, provider)
		first, cancelFirst := context.WithCancel(ctx)
		done := make(chan error, 2)
		for range 2 {
			go func() { _, err := q.Search(first, "gif", "cat"); done <- err }()
		}
		synctest.Wait()
		if calls.Load() != 2 {
			t.Fatal(calls.Load())
		}
		cancelled, stop := context.WithCancel(ctx)
		stop()
		for range cap(q.jobs) {
			q.jobs <- searchJob{ctx: cancelled, reply: make(chan searchResult, 1)}
		}
		if _, err := q.Search(ctx, "gif", "excess"); !errors.Is(err, ErrBusy) {
			t.Fatal("unbounded queue", err)
		}
		cancelFirst()
		synctest.Wait()
		for range 2 {
			if !errors.Is(<-done, context.Canceled) {
				t.Fatal("caller not cancelled")
			}
		}
		if calls.Load() != 2 {
			t.Fatal("cancelled jobs reached provider", calls.Load())
		}
		cancel()
		synctest.Wait()
	})
}
