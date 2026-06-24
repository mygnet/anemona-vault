export type SortDirection = 'asc' | 'desc' | null

export function nextSortDirection(direction: SortDirection): SortDirection {
  if (direction === 'asc') return 'desc'
  if (direction === 'desc') return null
  return 'asc'
}

export function sortByTitle<T extends { title: string }>(entries: T[], direction: SortDirection): T[] {
  if (direction === null) return entries
  return [...entries].sort((a, b) => {
    const cmp = a.title.localeCompare(b.title)
    return direction === 'asc' ? cmp : -cmp
  })
}

export function filterByText<T>(
  entries: T[],
  query: string,
  getFields: (entry: T) => unknown[],
): T[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return entries
  return entries.filter((entry) =>
    getFields(entry).some((value) =>
      String(value || '').toLowerCase().includes(normalized),
    ),
  )
}

export function sortAndFilterEntries<T extends { title: string }>(
  entries: T[],
  direction: SortDirection,
  query: string,
  getFields: (entry: T) => unknown[],
): T[] {
  return filterByText(sortByTitle(entries, direction), query, getFields)
}
