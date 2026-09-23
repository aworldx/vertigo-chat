package application

import "context"

type PublicationProfile struct {
	Nickname          string
	Messages, Seconds int
}
type DirectoryReader interface {
	PublicationProfile(context.Context, int64, bool) (PublicationProfile, error)
	PublicNames(context.Context, []int64) (map[int64]string, error)
}
type Directory struct{ reader DirectoryReader }

func NewDirectory(r DirectoryReader) Directory { return Directory{r} }
func (d Directory) PublicationProfile(ctx context.Context, id int64, lock bool) (PublicationProfile, error) {
	return d.reader.PublicationProfile(ctx, id, lock)
}
func (d Directory) PublicNames(ctx context.Context, ids []int64) (map[int64]string, error) {
	return d.reader.PublicNames(ctx, ids)
}
