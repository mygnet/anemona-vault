export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

export function renderMarkdown(content: string, emptyHtml: string): string {
  if (!content.trim()) return emptyHtml

  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCodeBlock = false
  let inUl = false
  let inOl = false
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushParagraph()
      closeLists()
      html.push(inCodeBlock ? '</code></pre>' : '<pre><code>')
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      html.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      closeLists()
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      closeLists()
      const level = heading[1].length
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const quote = trimmed.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      closeLists()
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`)
      continue
    }

    const ulItem = trimmed.match(/^[-*]\s+(.*)$/)
    if (ulItem) {
      flushParagraph()
      if (inOl) html.push('</ol>')
      inOl = false
      if (!inUl) html.push('<ul>')
      inUl = true
      html.push(`<li>${renderInlineMarkdown(ulItem[1])}</li>`)
      continue
    }

    const olItem = trimmed.match(/^\d+\.\s+(.*)$/)
    if (olItem) {
      flushParagraph()
      if (inUl) html.push('</ul>')
      inUl = false
      if (!inOl) html.push('<ol>')
      inOl = true
      html.push(`<li>${renderInlineMarkdown(olItem[1])}</li>`)
      continue
    }

    paragraph.push(trimmed)
  }

  flushParagraph()
  closeLists()
  if (inCodeBlock) html.push('</code></pre>')
  return html.join('')
}

export function filterPreviewContent(content: string, query: string, noMatchesText: string): string {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return content

  const matchedLines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.toLowerCase().includes(normalizedQuery))

  return matchedLines.length > 0 ? matchedLines.join('\n') : noMatchesText
}
