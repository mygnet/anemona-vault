export function applyInitialFilter(
  currentFilter: string,
  incomingFilter: string,
  lastAppliedFilter: string,
): { filterText: string; lastAppliedInitialFilter: string } {
  if (incomingFilter === lastAppliedFilter) {
    return { filterText: currentFilter, lastAppliedInitialFilter: lastAppliedFilter }
  }

  return { filterText: incomingFilter, lastAppliedInitialFilter: incomingFilter }
}

export function cloneEntries<T>(entries: T[], clone: (entry: T) => T = cloneShallow): T[] {
  return entries.map(clone)
}

export function cloneShallow<T>(entry: T): T {
  return { ...(entry as Record<string, unknown>) } as T
}

export function shouldSyncEntries<T>(incoming: T[], previous: T[]): boolean {
  return incoming !== previous
}

export function appendEntry<T>(entries: T[], entry: T): T[] {
  return [...entries, entry]
}

export function replaceEntry<T>(entries: T[], index: number, entry: T): T[] {
  return entries.map((current, currentIndex) => currentIndex === index ? entry : current)
}

export function removeEntry<T>(entries: T[], index: number): T[] {
  return entries.filter((_, currentIndex) => currentIndex !== index)
}

export function moveEntry<T>(entries: T[], fromIndex: number, targetIndex: number): T[] {
  if (
    fromIndex === targetIndex ||
    fromIndex < 0 ||
    targetIndex < 0 ||
    fromIndex >= entries.length ||
    targetIndex >= entries.length
  ) {
    return entries
  }

  const nextEntries = [...entries]
  const [entry] = nextEntries.splice(fromIndex, 1)
  if (!entry) return entries
  const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
  nextEntries.splice(insertIndex, 0, entry)
  return nextEntries
}
