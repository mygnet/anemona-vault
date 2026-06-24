type UnknownRecord = Record<string, unknown>

export function parseJsonLikeObject(text: string): UnknownRecord | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    const parsed = JSON.parse(trimmed)
    const obj = Array.isArray(parsed) ? parsed[0] : parsed
    return obj && typeof obj === 'object' ? obj as UnknownRecord : null
  } catch {
    return null
  }
}

export function cleanJsonLikeText(text: string): string {
  return text.trim().replace(/^[\{\[]\s*/, '').replace(/\s*[\}\]]$/, '').trim()
}

export function parseKeyValueLines(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of cleanJsonLikeText(text).split('\n')) {
    const raw = line.trim().replace(/,$/, '')
    const idx = raw.indexOf(':')
    if (idx <= 0) continue
    const key = raw.slice(0, idx).trim().toLowerCase().replace(/^["']|["']$/g, '')
    const value = raw.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !result[key]) result[key] = value
  }
  return result
}

export function firstNonEmptyLine(text: string): string {
  return cleanJsonLikeText(text).split('\n').find((line) => line.trim())?.trim() || ''
}

function stringField(obj: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null && String(value)) return String(value)
  }
  return ''
}

export function parseCommandSuggestion(text: string): { title: string; command: string } {
  const obj = parseJsonLikeObject(text)
  if (obj) {
    return {
      title: stringField(obj, ['title', 'name']),
      command: stringField(obj, ['command', 'cmd', 'code', 'script']),
    }
  }

  const fields = parseKeyValueLines(text)
  const cleaned = cleanJsonLikeText(text)
  return {
    title: fields.title || fields.name || firstNonEmptyLine(text).slice(0, 60),
    command: fields.command || fields.cmd || fields.code || fields.script || cleaned,
  }
}

export function parseSnippetSuggestion(
  text: string,
  languageId?: string,
): { title: string; language: string; code: string } {
  const obj = parseJsonLikeObject(text)
  if (obj) {
    return {
      title: stringField(obj, ['title', 'name']),
      language: stringField(obj, ['language', 'lang']) || languageId || 'text',
      code: stringField(obj, ['code', 'snippet']),
    }
  }

  const cleaned = cleanJsonLikeText(text)
  const fields = parseKeyValueLines(text)
  const codeBlock = cleaned.match(/```(\w*)\n([\s\S]*?)```/)
  const blockLanguage = codeBlock?.[1] || ''
  const blockCode = codeBlock?.[2]?.trim() || ''

  return {
    title: fields.title || fields.name || firstNonEmptyLine(text).slice(0, 60) || 'Snippet',
    language: fields.language || fields.lang || blockLanguage || languageId || 'text',
    code: fields.code || fields.snippet || blockCode || cleaned,
  }
}

export function parseTodoSuggestion(text: string): {
  title?: string
  text?: string
  priority?: 'high' | 'medium' | 'low'
  due?: string
} {
  const obj = parseJsonLikeObject(text)
  if (obj) {
    const priority = stringField(obj, ['priority']).toLowerCase()
    return {
      title: stringField(obj, ['title']),
      text: stringField(obj, ['task', 'text', 'title']),
      priority: ['high', 'medium', 'low'].includes(priority) ? priority as 'high' | 'medium' | 'low' : undefined,
      due: stringField(obj, ['due', 'dueAt']),
    }
  }

  const fields = parseKeyValueLines(text)
  const priority = fields.priority?.toLowerCase()
  let title = fields.title
  if (!title) {
    for (const line of cleanJsonLikeText(text).split('\n')) {
      const task = line.trim().match(/^[-*]\s+(?:\[.?\]\s+)?(.+)/)
      if (task?.[1]) {
        title = task[1].trim()
        break
      }
    }
  }

  return {
    title,
    text: fields.task || fields.text || title || firstNonEmptyLine(text),
    priority: ['high', 'medium', 'low'].includes(priority) ? priority as 'high' | 'medium' | 'low' : undefined,
    due: fields.due || fields.dueat,
  }
}

export function parseKeySuggestion(text: string): Record<string, string> {
  const knownFields: Record<string, string> = {
    username: 'username',
    user: 'username',
    nick: 'username',
    login: 'username',
    password: 'password',
    pass: 'password',
    pw: 'password',
    passwd: 'password',
    email: 'email',
    mail: 'email',
    e: 'email',
    url: 'url',
    uri: 'url',
    website: 'url',
    site: 'url',
    link: 'url',
    host: 'host',
    server: 'host',
    hostname: 'host',
    port: 'port',
    token: 'token',
    api_key: 'token',
    apikey: 'token',
    api: 'token',
    key: 'token',
    note: 'note',
    notes: 'note',
    description: 'note',
    desc: 'note',
    comment: 'note',
    title: 'title',
    name: 'title',
    label: 'title',
    service: 'title',
    account: 'title',
  }
  const result: Record<string, string> = {}
  const unknown: string[] = []
  const obj = parseJsonLikeObject(text)

  if (obj) {
    for (const [key, value] of Object.entries(obj)) {
      const mapped = knownFields[key.toLowerCase()]
      if (mapped) {
        if (!result[mapped]) result[mapped] = String(value ?? '')
      } else {
        unknown.push(`${key}: ${String(value ?? '')}`)
      }
    }
    if (unknown.length > 0) result.note = unknown.join('\n')
    return result
  }

  const fields = parseKeyValueLines(text)
  for (const [key, value] of Object.entries(fields)) {
    const mapped = knownFields[key]
    if (mapped && !result[mapped]) result[mapped] = value
  }
  return result
}
