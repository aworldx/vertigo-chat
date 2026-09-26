package domain

import (
	"regexp"
	"strings"
)

var addressedNickname = regexp.MustCompile(`^@?[\p{L}\p{N}_-]{1,24}$`)
var rewardWords = regexp.MustCompile(`[\p{L}]+`)
var rewardEmoji = regexp.MustCompile(`:[^:\s]+:`)
var trivialRewardWord = regexp.MustCompile(`^(ку+|куку|привет+|приветик|приветики|прив|хай|хеллоу|hello|hi|hey|здравствуй|здравствуйте|здарова|здорово|доброго|добрый|доброе|день|утро|вечер|ночи|спокойной|пока|всем|всех|вам|тебе|тебя|спасибо|спс|благодарю|пожалуйста|пж|за|помощь|да|нет|ага|угу|ок|окей|ok|okay|лол|lol|ахаха|хаха|ха|класс|супер|круто|молодец|молодцы|красавчик|держись|рядом|я|мы|ты|так|держать|с|вами|тобой|как|дела|вы|друзья|народ|ребята)$`)

// PositiveEvidence permits semantic assessment; it never awards karma itself.
// Obvious greetings, courtesy and filler cannot be rewarded even if the model
// mistakes politeness for help. Negative assessments remain context-dependent.
func PositiveEvidence(body string) bool {
	text := strings.ToLower(strings.TrimSpace(body))
	if nickname, rest, ok := strings.Cut(text, ","); ok && addressedNickname.MatchString(strings.TrimSpace(nickname)) {
		text = rest
	}
	words := rewardWords.FindAllString(rewardEmoji.ReplaceAllString(text, " "), -1)
	for _, word := range words {
		if !trivialRewardWord.MatchString(word) {
			return true
		}
	}
	return false
}
