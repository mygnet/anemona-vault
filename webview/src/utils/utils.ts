export function generateDeleteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export function generateId(): string {
  const hex = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    '8' + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-')
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function floorToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60000) * 60000)
}

export function computeNextDue(dueAt: string, unit: string, value: number): string | null {
  const date = new Date(dueAt)
  if (isNaN(date.getTime())) return null
  switch (unit) {
    case 'minute': date.setMinutes(date.getMinutes() + value); break
    case 'hour': date.setHours(date.getHours() + value); break
    case 'day': date.setDate(date.getDate() + value); break
    case 'week': date.setDate(date.getDate() + value * 7); break
    case 'month': date.setMonth(date.getMonth() + value); break
    case 'year': date.setFullYear(date.getFullYear() + value); break
    default: return null
  }
  return date.toISOString()
}
