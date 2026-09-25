package postgres

import (
	"context"
	"time"
)

// AmbientLeader elects one scheduler across API processes without holding a transaction.
// A dedicated connection owns the lock until shutdown; losing it cancels the worker.
func (s Store) AmbientLeader(ctx context.Context, run func(context.Context)) error {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	var locked bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock(8420932)`).Scan(&locked); err != nil {
		return err
	}
	if !locked {
		return nil
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(cleanup, `SELECT pg_advisory_unlock(8420932)`)
	}()
	worker, cancel := context.WithCancel(ctx)
	defer cancel()
	done := make(chan struct{})
	go func() { defer close(done); run(worker) }()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return nil
		case <-ctx.Done():
			cancel()
			<-done
			return ctx.Err()
		case <-ticker.C:
			ping, stop := context.WithTimeout(ctx, 3*time.Second)
			err := conn.Ping(ping)
			stop()
			if err != nil {
				cancel()
				<-done
				return err
			}
		}
	}
}
