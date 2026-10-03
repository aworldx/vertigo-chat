// Decorative, pre-generated assets, not a claim about an article's subject.
const covers = ["books", "path", "window"] as const
export function articleCover(id: number, image?: string): string {
  if (image && /^\/images\/[a-z0-9-]+\.(png|webp|jpg)$/.test(image)) return image
  const index = Number.isSafeInteger(id) && id > 0 ? (id - 1) % covers.length : 0
  return `/images/library-cover-${covers[index] ?? "books"}.png`
}
