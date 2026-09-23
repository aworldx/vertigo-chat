package application

import (
	"context"
	"errors"
)

var ErrForbidden = errors.New("forbidden")

type Overview struct {
	Tables, Columns []string
	Selected        string
	Rows            [][]string
}
type Reader interface {
	Overview(context.Context, string) (Overview, error)
}
type Administrator func(context.Context, int64) (bool, error)
type Database struct {
	reader  Reader
	allowed Administrator
}

func NewDatabase(r Reader, a Administrator) Database { return Database{r, a} }
func (d Database) Read(ctx context.Context, user int64, table string) (Overview, error) {
	ok, err := d.allowed(ctx, user)
	if err != nil {
		return Overview{}, err
	}
	if !ok {
		return Overview{}, ErrForbidden
	}
	return d.reader.Overview(ctx, table)
}
