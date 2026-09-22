// Package domain contains profile types without HTTP or storage dependencies.
package domain

type Profile struct {
	Nickname           string
	Name               *string
	BirthDate          *string
	Gender             *string
	About              *string
	HasPhoto           bool
	HasThumbnail       bool
	PublicMessageCount int
	ChatSeconds        int
}

type Page struct {
	Profiles   []Profile
	Number     int
	Size       int
	Total      int
	TotalPages int
}

type UpdateInput struct {
	Name      StringField
	BirthDate StringField
	Gender    StringField
	About     StringField
}

type StringField struct {
	Set   bool
	Value *string
}

type PhotoInput struct {
	Bytes       []byte
	ContentType string
}

type Media struct {
	Bytes       []byte
	ContentType string
}
