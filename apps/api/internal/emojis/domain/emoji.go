package domain

type Emoji struct {
	ID            int64
	Code          string
	Width, Height int
	Terms         []string
}
type Image struct {
	Bytes            []byte
	Key, ContentType string
}
