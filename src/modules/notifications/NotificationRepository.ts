import * as fs from 'fs'
import * as path from 'path'
import type { VaultNotification, NotificationIndex, NotificationStatus, HistoryIndex, NotificationConfig } from './NotificationTypes'

const INDEX_VERSION = 1
const HISTORY_INDEX_VERSION = 1
const PAGE_SIZE = 100

export class NotificationRepository {
  private storagePath: string
  private inbox: VaultNotification[] = []
  private index: NotificationIndex = { version: INDEX_VERSION, lastCheckAt: null, generatedKeys: [] }
  private historyIndex: HistoryIndex = { version: HISTORY_INDEX_VERSION, pageSize: PAGE_SIZE, currentPage: 0, currentFile: '', totalPages: 0, totalNotifications: 0, lastUpdatedAt: '' }
  private config: NotificationConfig = {}

  constructor(storagePath: string) {
    this.storagePath = storagePath
    this.load()
    this.migrateFromLegacyHistory()
  }

  setStoragePath(newPath: string): void {
    this.storagePath = newPath
    this.inbox = []
    this.index = { version: INDEX_VERSION, lastCheckAt: null, generatedKeys: [] }
    this.historyIndex = { version: HISTORY_INDEX_VERSION, pageSize: PAGE_SIZE, currentPage: 0, currentFile: '', totalPages: 0, totalNotifications: 0, lastUpdatedAt: '' }
    this.config = {}
    this.load()
    this.migrateFromLegacyHistory()
  }

  private get baseDir(): string {
    return path.join(this.storagePath, '.anemona', 'notifications')
  }

  private get historyDir(): string {
    return path.join(this.baseDir, 'history')
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true })
    }
  }

  private ensureHistoryDir(): void {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true })
    }
  }

  private now(): string {
    return new Date().toISOString()
  }

  private loadFile<T>(fileName: string, fallback: T): T {
    const fp = path.join(this.baseDir, fileName)
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8')
        return JSON.parse(raw) as T
      }
    } catch {
      // ignore
    }
    return fallback
  }

  private loadHistoryFile<T>(fileName: string, fallback: T): T {
    const fp = path.join(this.historyDir, fileName)
    try {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, 'utf-8')
        return JSON.parse(raw) as T
      }
    } catch {
      // ignore
    }
    return fallback
  }

  private writeFile(fileName: string, data: unknown): void {
    this.ensureDir()
    fs.writeFileSync(
      path.join(this.baseDir, fileName),
      JSON.stringify(data, null, 2),
      'utf-8',
    )
  }

  private writeConfig(): void {
    this.writeFile('.config.json', this.config)
  }

  private writeHistoryFile(fileName: string, data: unknown): void {
    this.ensureHistoryDir()
    fs.writeFileSync(
      path.join(this.historyDir, fileName),
      JSON.stringify(data, null, 2),
      'utf-8',
    )
  }

  private pageFileName(pageNum: number): string {
    return `page-${String(pageNum).padStart(4, '0')}.json`
  }

  private sortNewestFirst(notifications: VaultNotification[]): VaultNotification[] {
    return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  private sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  reload(): void {
    this.load()
  }

  private migrateFromLegacyHistory(): void {
    const legacyPath = path.join(this.baseDir, 'history.json')
    if (!fs.existsSync(legacyPath)) return
    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8')
      const legacy = JSON.parse(raw) as VaultNotification[]
      if (!Array.isArray(legacy) || legacy.length === 0) {
        fs.unlinkSync(legacyPath)
        return
      }
      legacy.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      for (const notification of legacy) {
        this.appendToHistory(notification)
      }
      fs.unlinkSync(legacyPath)
    } catch {
      // skip migration on error
    }
  }

  private load(): void {
    this.inbox = this.loadFile<VaultNotification[]>('inbox.json', [])
    this.index = this.loadFile<NotificationIndex>('index.json', {
      version: INDEX_VERSION,
      lastCheckAt: null,
      generatedKeys: [],
    })
    this.historyIndex = this.loadHistoryFile<HistoryIndex>('index.json', {
      version: HISTORY_INDEX_VERSION,
      pageSize: PAGE_SIZE,
      currentPage: 0,
      currentFile: '',
      totalPages: 0,
      totalNotifications: 0,
      lastUpdatedAt: '',
    })
    this.config = this.loadFile<NotificationConfig>('.config.json', {})
    this.rebuildIndexAndRemoveDuplicates()
    this.normalizeHistoryPages()
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  updateConfig(config: NotificationConfig): void {
    this.config = { ...config }
    this.writeConfig()
  }

  private rebuildIndexAndRemoveDuplicates(): void {
    const seen = new Set<string>()
    const normalize = (items: VaultNotification[]) => items.filter((notification) => {
      const key = notification.key
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    const inbox = normalize(this.inbox)
    const changed = inbox.length !== this.inbox.length

    this.inbox = inbox
    this.index.generatedKeys = Array.from(new Set([
      ...this.index.generatedKeys.filter(Boolean),
      ...inbox.map(n => n.key),
    ]))

    if (changed) {
      this.saveInbox()
      this.writeFile('index.json', this.index)
    }
  }

  private saveInbox(): void {
    this.inbox = this.sortNewestFirst(this.inbox)
    this.writeFile('inbox.json', this.inbox)
  }

  private saveHistoryIndex(): void {
    this.historyIndex.lastUpdatedAt = this.now()
    this.writeHistoryFile('index.json', this.historyIndex)
  }

  keyExists(key: string): boolean {
    return this.index.generatedKeys.includes(key)
  }

  addKey(key: string): void {
    if (!this.index.generatedKeys.includes(key)) {
      this.index.generatedKeys.push(key)
      this.writeFile('index.json', this.index)
    }
  }

  removeGeneratedKey(key: string): boolean {
    const idx = this.index.generatedKeys.indexOf(key)
    if (idx === -1) return false
    this.index.generatedKeys.splice(idx, 1)
    this.writeFile('index.json', this.index)
    return true
  }

  removeGeneratedKeysByPrefix(prefix: string): number {
    const before = this.index.generatedKeys.length
    this.index.generatedKeys = this.index.generatedKeys.filter(k => !k.startsWith(prefix))
    const removed = before - this.index.generatedKeys.length
    if (removed > 0) {
      this.writeFile('index.json', this.index)
    }
    return removed
  }

  addToInbox(notification: VaultNotification): void {
    if (this.inbox.some(n => n.key === notification.key)) return
    this.inbox.unshift(notification)
    this.saveInbox()
  }

  private loadHistoryPage(pageNum: number): VaultNotification[] {
    return this.sortNewestFirst(this.loadHistoryFile<VaultNotification[]>(this.pageFileName(pageNum), []))
  }

  private saveHistoryPage(pageNum: number, notifications: VaultNotification[]): void {
    this.writeHistoryFile(this.pageFileName(pageNum), this.sortNewestFirst(notifications))
  }

  private normalizeHistoryPages(): void {
    if (this.historyIndex.totalPages <= 0) return

    const all: VaultNotification[] = []
    for (let p = 1; p <= this.historyIndex.totalPages; p++) {
      all.push(...this.loadHistoryPage(p))
    }

    const orderedOldestFirst = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const totalPages = Math.ceil(orderedOldestFirst.length / PAGE_SIZE)
    const currentFile = totalPages > 0 ? this.pageFileName(totalPages) : ''
    let changed =
      this.historyIndex.currentPage !== totalPages ||
      this.historyIndex.currentFile !== currentFile ||
      this.historyIndex.totalPages !== totalPages ||
      this.historyIndex.totalNotifications !== orderedOldestFirst.length

    for (let p = 1; p <= totalPages; p++) {
      const start = (p - 1) * PAGE_SIZE
      const pageItems = this.sortNewestFirst(orderedOldestFirst.slice(start, start + PAGE_SIZE))
      const currentItems = this.loadHistoryFile<VaultNotification[]>(this.pageFileName(p), [])
      if (!this.sameJson(currentItems, pageItems)) {
        this.saveHistoryPage(p, pageItems)
        changed = true
      }
    }

    for (let p = totalPages + 1; p <= this.historyIndex.totalPages; p++) {
      const filePath = path.join(this.historyDir, this.pageFileName(p))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        changed = true
      }
    }

    if (changed) {
      this.historyIndex.currentPage = totalPages
      this.historyIndex.currentFile = currentFile
      this.historyIndex.totalPages = totalPages
      this.historyIndex.totalNotifications = orderedOldestFirst.length
      this.saveHistoryIndex()
    }
  }

  private moveToHistory(id: string, status: NotificationStatus): VaultNotification | null {
    const idx = this.inbox.findIndex(n => n.id === id)
    if (idx === -1) return null

    const [notification] = this.inbox.splice(idx, 1)
    notification.status = status
    this.saveInbox()
    this.appendToHistory(notification)
    return notification
  }

  private appendToHistory(notification: VaultNotification): void {
    let page = this.historyIndex.currentPage
    let notifications: VaultNotification[] = []

    if (page > 0) {
      notifications = this.loadHistoryPage(page)
    }

    if (notifications.length >= PAGE_SIZE) {
      page++
      notifications = []
    }

    notifications.push(notification)
    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    if (page === 0) page = 1
    this.historyIndex.currentPage = page
    this.historyIndex.currentFile = this.pageFileName(page)
    this.historyIndex.totalPages = page
    this.historyIndex.totalNotifications++
    this.saveHistoryPage(page, notifications)
    this.saveHistoryIndex()
  }

  private findInHistoryPages(id: string): { page: number; items: VaultNotification[]; index: number } | null {
    for (let p = 1; p <= this.historyIndex.totalPages; p++) {
      const items = this.loadHistoryPage(p)
      const idx = items.findIndex(n => n.id === id)
      if (idx !== -1) return { page: p, items, index: idx }
    }
    return null
  }

  markRead(id: string): VaultNotification | null {
    const n = this.moveToHistory(id, 'read')
    if (n) {
      n.readAt = new Date().toISOString()
      this.updateReadAt(n)
    }
    return n
  }

  private updateReadAt(notification: VaultNotification): void {
    for (let p = 1; p <= this.historyIndex.totalPages; p++) {
      const items = this.loadHistoryPage(p)
      const idx = items.findIndex(n => n.id === notification.id)
      if (idx !== -1) {
        items[idx] = notification
        this.saveHistoryPage(p, items)
        return
      }
    }
  }

  markUnread(id: string): VaultNotification | null {
    const found = this.findInHistoryPages(id)
    if (!found) return null

    const [notification] = found.items.splice(found.index, 1)
    notification.status = 'unread'
    notification.readAt = null
    this.saveHistoryPage(found.page, found.items)
    this.historyIndex.totalNotifications--
    this.saveHistoryIndex()

    this.inbox.push(notification)
    this.saveInbox()
    return notification
  }

  deleteFromHistory(id: string): boolean {
    const found = this.findInHistoryPages(id)
    if (!found) return false

    found.items.splice(found.index, 1)
    this.saveHistoryPage(found.page, found.items)
    this.historyIndex.totalNotifications--
    this.saveHistoryIndex()
    return true
  }

  removeFromInboxByKey(key: string): void {
    const before = this.inbox.length
    this.inbox = this.inbox.filter(n => n.key !== key)
    if (this.inbox.length !== before) {
      this.saveInbox()
    }
  }

  getInbox(): VaultNotification[] {
    return [...this.inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getHistoryPage(pageNum: number): VaultNotification[] {
    return this.loadHistoryPage(pageNum)
  }

  getHistoryIndex(): HistoryIndex {
    return { ...this.historyIndex }
  }

  getAll(): VaultNotification[] {
    if (this.historyIndex.totalPages === 0) return [...this.inbox]
    const history: VaultNotification[] = []
    for (let p = 1; p <= this.historyIndex.totalPages; p++) {
      history.push(...this.loadHistoryPage(p))
    }
    return [...this.inbox, ...history]
  }

  getPendingCount(): number {
    return this.inbox.length
  }

  setLastCheckAt(iso: string): void {
    this.index.lastCheckAt = iso
    this.writeFile('index.json', this.index)
  }

  getLastCheckAt(): string | null {
    return this.index.lastCheckAt
  }
}
