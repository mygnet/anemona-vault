export function deriveTitle(text: string, fallback = 'Untitled', wordCount = 3): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, wordCount).join(' ') || fallback
}
