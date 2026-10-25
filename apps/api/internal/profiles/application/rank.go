package application

import "chat/api/internal/profiles/domain"

func Rank(messages, seconds int) (string, string) { return domain.Rank(messages, seconds) }

func CanAddGalleryPhotos(messages, seconds int) bool {
	return Limits(messages, seconds).Photos > 0
}

func CanAddLibraryArticles(messages, seconds int) bool {
	return Limits(messages, seconds).Articles > 0
}

type PublicationLimits = domain.PublicationLimits

func Limits(messages, seconds int) PublicationLimits {
	return domain.CurrentRank(messages, seconds).Limits
}
