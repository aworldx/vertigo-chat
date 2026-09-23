package application

import "chat/api/internal/profiles/domain"

func Rank(messages, seconds int) (string, string) { return domain.Rank(messages, seconds) }

func CanAddGalleryPhotos(messages, seconds int) bool {
	return domain.MeetsRank(messages, seconds, "Статист")
}

func CanAddLibraryArticles(messages, seconds int) bool {
	return domain.MeetsRank(messages, seconds, "Киноман")
}
