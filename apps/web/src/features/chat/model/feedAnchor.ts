// Retained DOM nodes identify the same content across a rolling history window.
// Measuring before the next update lets the frame compensate for removed rows.
export function feedOffsets(element: HTMLElement): Map<Element, number> {
  const top = element.getBoundingClientRect().top
  return new Map(
    Array.from(element.children, (child) => [child, child.getBoundingClientRect().top - top + element.scrollTop]),
  )
}
export function retainedOffset(element: HTMLElement, previous: Map<Element, number>, scrollTop: number): number {
  const top = element.getBoundingClientRect().top
  let shift = 0
  for (const [child, offset] of previous) {
    if (child.parentElement !== element) continue
    shift = child.getBoundingClientRect().top - top + element.scrollTop - offset
    // Prefer visible content: older private messages/files may remain ahead of
    // the public rows removed by the 100-message window.
    if (offset >= scrollTop) return shift
  }
  return shift
}
