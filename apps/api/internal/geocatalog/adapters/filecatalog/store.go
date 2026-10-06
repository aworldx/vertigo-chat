// Package filecatalog persists the preparation catalogue; it is not runtime DB storage.
package filecatalog

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"chat/api/internal/geocatalog/domain"
)

type Store struct{ Path string }

func (s Store) Update(fn func(domain.Catalog) (domain.Catalog, error), apply bool) error {
	lock, err := os.OpenFile(s.Path+".lock", os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("catalogue lock (another import may be running): %w", err)
	}
	defer func() { _ = lock.Close(); _ = os.Remove(s.Path + ".lock") }()
	c, err := s.read()
	if err != nil {
		return err
	}
	next, err := fn(c)
	if err != nil {
		return err
	}
	if err := next.Validate(); err != nil {
		return err
	}
	if !apply {
		return nil
	}
	return s.write(next)
}

func (s Store) read() (domain.Catalog, error) {
	f, err := os.Open(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return domain.New(), nil
	}
	if err != nil {
		return domain.Catalog{}, err
	}
	defer func() { _ = f.Close() }()
	data, err := io.ReadAll(io.LimitReader(f, 64*1024*1024+1))
	if err != nil {
		return domain.Catalog{}, err
	}
	if len(data) > 64*1024*1024 {
		return domain.Catalog{}, fmt.Errorf("catalogue exceeds 64 MiB")
	}
	var c domain.Catalog
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(&c); err != nil {
		return c, err
	}
	if err := d.Decode(new(json.RawMessage)); err != io.EOF {
		return c, fmt.Errorf("trailing catalogue content")
	}
	return c, c.Validate()
}

func (s Store) write(c domain.Catalog) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	previous, err := os.ReadFile(s.Path)
	if err == nil && bytes.Equal(previous, data) {
		return nil
	}
	f, err := os.CreateTemp(filepath.Dir(s.Path), ".geo-import-*")
	if err != nil {
		return err
	}
	defer func() { _ = f.Close(); _ = os.Remove(f.Name()) }()
	if err := f.Chmod(0644); err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), s.Path)
}
