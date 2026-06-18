export type SortDirection = 'asc' | 'desc' | null

export function toggleSort(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}
