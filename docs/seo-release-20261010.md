# Поисковая индексация — 0.24.4

Пользователь разрешил выпуск исправлений и добавление главной в sitemap.
Go webdelivery теперь отдаёт sitemap из семи канонических публичных URL:
главная, library, help, индекс статей и три статьи. Robots указывает sitemap;
машинные API-пути закрыты от обхода. Публичные страницы получают index/follow
и canonical, готовая разметка статей сохраняется. /about перенаправляется 301
на главную. Остальные страницы сохраняют noindex; механизмы доступа не менялись.
Внешний вид и клиентская бизнес-логика не менялись. Миграций БД нет.

В закреплённом Linux Docker (chat-quality:local, точные исходники) успешно:
- Go race webdelivery и entrance, go vet и golangci-lint webdelivery, сборка API.
- HTTP: XML namespace, все семь URL, canonical origin независимо от Host,
  GET/HEAD sitemap и robots, 301 about, noindex личных страниц, сохранение
  метаданных предварительно отрендеренных статей; прежние проверки файла Google.
- Основной verifier: прямой вход и reload семи публичных страниц, robots/canonical,
  редирект about, sitemap/robots, noindex входа, desktop/mobile без overflow.
- Повторный landing verifier: desktop/tablet/mobile, все ссылки, инструкции игр,
  переключение регистрации, гостевой вход, сообщение и выход.
- TypeScript и целевые ESLint/Prettier browser/search-verification.ts.

PostgreSQL-логика не менялась, её тесты прошли перед предыдущим выпуском 0.24.3.
Полный script/check и внешние AI/медиа не запускались. Наличие URL в sitemap
не гарантирует индексацию: Search Console должна повторно обработать сайт.

Выпуск: GitLab API image точного SHA через script/deploy-production api.
Rollback: api-8570f0a2ae8b90af2273105fe36d3fff70c21b72.
Резервная копия предыдущего выпуска:
/opt/backups/vertigo-chat/landing-0.24.3-20261010T101317Z.

## Production подтверждён

2026-10-10 выпущен commit b9a2df8def5e29211eb5b72f65cb9b61af3c015d,
контейнер API healthy, образ соответствует точному SHA. На HTTPS прошёл
тот же browser search-verification: все 7 страниц с reload и canonical/index,
/about → /, sitemap/robots и noindex страницы входа. Предыдущий production
landing smoke также прошёл на 1440×900, 768×1024 и 390×844, файл Google
совпал побайтно, JS bundle совпал SHA-256 с проверенной сборкой.
