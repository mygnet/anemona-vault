import * as fs from 'fs'
import * as path from 'path'
import type { ScheduledEvent, ScheduledEventsCacheData, ScheduledEventSource, ScheduledEventStatus } from './NotificationTypes'

const CACHE_VERSION = 2

type ExtractedEvent = Omit<ScheduledEvent, 'createdAt' | 'updatedAt'>

export class ScheduledEventsCache {
  private onDidChange: (() => void) | null = null
  private storagePath: string

  constructor(storagePath: string) {
    this.storagePath = storagePath
  }

  setStoragePath(newPath: string): void {
    this.storagePath = newPath
    this.rebuild()
  }

  setOnDidChange(callback: () => void): void {
    this.onDidChange = callback
  }

  private get cacheDir(): string {
    return path.join(this.storagePath, '.anemona', 'cache')
  }

  private get cachePath(): string {
    return path.join(this.cacheDir, 'scheduled-events.json')
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  private now(): string {
    return new Date().toISOString()
  }

  private toRelative(filePath: string): string {
    return path.relative(this.storagePath, filePath).split(path.sep).join('/')
  }

  resolveSourceFile(sourceFile: string): string {
    return path.isAbsolute(sourceFile) ? sourceFile : path.join(this.storagePath, sourceFile)
  }

  exists(): boolean {
    return fs.existsSync(this.cachePath)
  }

  loadOrCreate(): ScheduledEventsCacheData {
    if (!this.exists()) {
      return this.rebuild()
    }

    try {
      const raw = fs.readFileSync(this.cachePath, 'utf-8')
      const parsed = JSON.parse(raw) as ScheduledEventsCacheData
      if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.events)) {
        return this.rebuild()
      }
      return parsed
    } catch {
      return this.rebuild()
    }
  }

  save(data: ScheduledEventsCacheData): void {
    this.ensureDir()
    fs.writeFileSync(this.cachePath, JSON.stringify({ ...data, updatedAt: this.now() }, null, 2), 'utf-8')
    this.onDidChange?.()
  }

  rebuild(): ScheduledEventsCacheData {
    const now = this.now()
    const events: ScheduledEvent[] = []
    for (const filePath of this.listEventFiles(this.storagePath)) {
      for (const event of this.extractEventsFromFile(filePath)) {
        events.push({ ...event, createdAt: now, updatedAt: now })
      }
    }
    const data: ScheduledEventsCacheData = { version: CACHE_VERSION, updatedAt: now, events }
    this.save(data)
    return data
  }

  syncFile(filePath: string): void {
    if (!this.isEventFile(filePath)) return
    const data = this.loadOrCreate()
    const rel = this.toRelative(filePath)
    const now = this.now()
    const extracted = fs.existsSync(filePath) ? this.extractEventsFromFile(filePath) : []
    const extractedById = new Map(extracted.map(event => [event.id, event]))
    const next: ScheduledEvent[] = []

    for (const existing of data.events) {
      if (existing.sourceFile !== rel) {
        next.push(existing)
        continue
      }

      const current = extractedById.get(existing.id)
      if (!current) {
        next.push({ ...existing, status: 'cancelled', updatedAt: now })
        continue
      }

    const changed = existing.dueAt !== current.dueAt || existing.title !== current.title || existing.message !== current.message
      const status = current.status === 'pending'
        ? (changed ? 'pending' : existing.status === 'notified' ? 'notified' : 'pending')
        : current.status

      next.push({
        ...existing,
        ...current,
        status,
        createdAt: existing.createdAt,
        updatedAt: changed || existing.status !== status ? now : existing.updatedAt,
      })
      extractedById.delete(existing.id)
    }

    for (const event of extractedById.values()) {
      next.push({ ...event, createdAt: now, updatedAt: now })
    }

    this.save({ ...data, events: next })
  }

  cancelFile(filePath: string): void {
    const data = this.loadOrCreate()
    const rel = this.toRelative(filePath)
    const now = this.now()
    this.save({
      ...data,
      events: data.events.map(event => event.sourceFile === rel ? { ...event, status: 'cancelled', updatedAt: now } : event),
    })
  }

  private listEventFiles(dirPath: string): string[] {
    const result: string[] = []
    if (!fs.existsSync(dirPath)) return result

    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        result.push(...this.listEventFiles(fullPath))
      } else if (entry.isFile() && this.isEventFile(fullPath)) {
        result.push(fullPath)
      }
    }
    return result
  }

  private isEventFile(filePath: string): boolean {
    return filePath.endsWith('.anemona-reminder') || filePath.endsWith('.anemona-todo')
  }

  private extractEventsFromFile(filePath: string): ExtractedEvent[] {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8').trim()
      if (!raw) return []
      const entries = JSON.parse(raw)
      if (!Array.isArray(entries)) return []
      return filePath.endsWith('.anemona-reminder')
        ? this.extractReminderEvents(filePath, entries)
        : this.extractTaskEvents(filePath, entries)
    } catch {
      return []
    }
  }

  private buildEvent(filePath: string, source: ScheduledEventSource, sourceId: string, dueAt: string, title: string, message: string, status: ScheduledEventStatus): ExtractedEvent {
    const rel = this.toRelative(filePath)
    return {
      id: `${source}:${sourceId}`,
      source,
      sourceFile: rel,
      sourceFileName: path.basename(filePath),
      sourceId,
      dueAt,
      notificationKey: `${source}:${sourceId}`,
      status,
      title,
      message,
    }
  }

  private extractReminderEvents(filePath: string, entries: any[]): ExtractedEvent[] {
    const result: ExtractedEvent[] = []
    for (const entry of entries) {
      const id = String(entry?.id || '').trim()
      const dueAt = typeof entry?.dueAt === 'string' ? entry.dueAt.trim() : ''
      if (!id || !dueAt) continue
      const status: ScheduledEventStatus = entry?.status === 'completed' ? 'completed' : 'pending'
      const text = String(entry?.text || '').trim()
      const title = String(entry?.title || '').trim() || this.deriveTitle(text) || 'Recordatorio'
      result.push(this.buildEvent(filePath, 'reminder', id, dueAt, title, text, status))
    }
    return result
  }

  private extractTaskEvents(filePath: string, entries: any[]): ExtractedEvent[] {
    const result: ExtractedEvent[] = []
    for (const entry of entries) {
      const id = String(entry?.id || '').trim()
      const dueAt = typeof entry?.dueAt === 'string' ? entry.dueAt.trim() : ''
      if (!id || !dueAt) continue
      const status: ScheduledEventStatus = entry?.status === 'done'
        ? 'completed'
        : entry?.status === 'cancelled'
          ? 'cancelled'
          : 'pending'
      const title = String(entry?.title || '').trim() || 'Tarea pendiente'
      const message = String(entry?.text || '').trim()
      result.push(this.buildEvent(filePath, 'task', id, dueAt, title, message, status))
    }
    return result
  }

  private deriveTitle(text: string): string {
    return text.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ')
  }
}
