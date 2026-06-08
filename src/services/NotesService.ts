import * as fs from 'fs'
import * as path from 'path'
import { ConfigService } from './ConfigService'
import { CryptoService } from './CryptoService'
import type { Category, CategoryConfig, FileType, KeyEntry, CommandEntry, TodoEntry, Note } from '../types/notes'

export class NotesService {
  private storagePath: string | undefined
  private _crypto: CryptoService | null = null
  private readonly defaultCategoryColor = 'vscode-soft'

  constructor() {
    this.storagePath = ConfigService.getStoragePath()
  }

  get crypto(): CryptoService {
    if (!this._crypto) {
      this._crypto = new CryptoService(this.ensureStoragePath())
    }
    return this._crypto
  }

  setStoragePath(newPath: string): void {
    this.storagePath = newPath
    this._crypto = null
  }

  getStoragePath(): string | undefined {
    return this.storagePath
  }

  getStorageName(): string | undefined {
    if (!this.storagePath) return undefined
    return path.basename(path.normalize(this.storagePath))
  }

  private ensureStoragePath(): string {
    if (!this.storagePath) {
      throw new Error('Storage path not configured')
    }
    const normalized = path.normalize(this.storagePath)
    if (!fs.existsSync(normalized)) {
      fs.mkdirSync(normalized, { recursive: true })
    }
    return normalized
  }

  isLockedFile(fileName: string): boolean {
    return fileName.endsWith('.anemona-lock')
  }

  getFileType(fileName: string): FileType {
    if (fileName.endsWith('.anemona-key') || fileName.endsWith('.anemona-lock')) return 'key'
    if (fileName.endsWith('.anemona-command')) return 'command'
    if (fileName.endsWith('.anemona-todo')) return 'todo'
    return 'md'
  }

  getFileIcon(fileName: string): string {
    if (fileName.endsWith('.anemona-lock')) return '🔒'
    const type = this.getFileType(fileName)
    switch (type) {
      case 'key': return '🔑'
      case 'command': return '⌘'
      case 'todo': return '☑️'
      default: return '📄'
    }
  }

  getDisplayName(fileName: string): string {
    return fileName
      .replace(/\.anemona-lock$/, '')
      .replace(/\.anemona-key$/, '')
      .replace(/\.anemona-command$/, '')
      .replace(/\.anemona-todo$/, '')
      .replace(/\.md$/, '')
  }

  private readonly categoryColors = [
    'vscode-default', 'vscode-muted', 'vscode-soft',
    '#e17076', '#f5a623', '#f7dc6f', '#68c3a0',
    '#54a0ff', '#a29bfe', '#fd79a8', '#00cec9', '#d8dee9',
    '#6c5ce7', '#e84393', '#00b894', '#0984e3', '#f5f7fa',
  ]

  async initializeDefaultCategories(rootPath: string): Promise<void> {
    const categories = ConfigService.getDefaultCategories()
    let colorIndex = 0
    for (const category of categories) {
      const dir = path.join(rootPath, this.sanitizePathName(category))
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const configPath = path.join(dir, '.config.json')
      if (!fs.existsSync(configPath)) {
        const color = this.defaultCategoryColor
        fs.writeFileSync(configPath, JSON.stringify({ color }, null, 2), 'utf-8')
        colorIndex++
      }
    }
  }

  getCategories(): Category[] {
    try {
      const rootPath = this.ensureStoragePath()
      const entries = fs.readdirSync(rootPath, { withFileTypes: true })
      const categories: Category[] = []

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('@')) {
          const categoryPath = path.join(rootPath, entry.name)
          const config = this.readCategoryConfigSync(categoryPath)
          categories.push({
            name: entry.name,
            path: categoryPath,
            notes: [],
            config: config ?? undefined,
            canDelete: this.canDeleteCategorySync(entry.name),
          })
        }
      }

      return categories.sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  private readCategoryConfigSync(categoryPath: string): CategoryConfig | null {
    try {
      const configPath = path.join(categoryPath, '.config.json')
      if (!fs.existsSync(configPath)) return null
      const raw = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(raw) as CategoryConfig
    } catch {
      return null
    }
  }

  async readCategoryConfig(categoryName: string): Promise<CategoryConfig | null> {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName))
    return this.readCategoryConfigSync(categoryPath)
  }

  async writeCategoryConfig(categoryName: string, config: CategoryConfig): Promise<void> {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName))
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true })
    }
    const configPath = path.join(categoryPath, '.config.json')
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  async updateCategoryColor(categoryName: string, color: string): Promise<void> {
    const current = (await this.readCategoryConfig(categoryName)) ?? {}
    await this.writeCategoryConfig(categoryName, {
      ...current,
      color,
    })
  }

  getNotesForCategory(categoryName: string): Note[] {
    try {
      const rootPath = this.ensureStoragePath()
      const categoryPath = path.join(rootPath, categoryName)

      if (!fs.existsSync(categoryPath)) {
        return []
      }

      const entries = fs.readdirSync(categoryPath, { withFileTypes: true })
      const notes: Note[] = []

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const ext = path.extname(entry.name)
          if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo') {
            const filePath = path.join(categoryPath, entry.name)
            notes.push({
              name: entry.name,
              filePath,
              content: '',
              fileType: this.getFileType(entry.name),
            })
          }
        }
      }

      return notes.sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  async createNote(categoryName: string, title: string, fileType: FileType = 'md'): Promise<Note> {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName))

    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true })
    }

    const ext = fileType === 'key'
      ? '.anemona-key'
      : fileType === 'command'
        ? '.anemona-command'
        : fileType === 'todo'
          ? '.anemona-todo'
          : '.md'
    const fileName = this.sanitizePathName(title) + ext
    const filePath = path.join(categoryPath, fileName)

    if (fs.existsSync(filePath)) {
      throw new Error(`Note "${title}" already exists in ${categoryName}`)
    }

    let content: string
    if (fileType === 'key') {
      content = JSON.stringify([], null, 2)
    } else if (fileType === 'command') {
      content = JSON.stringify([], null, 2)
    } else if (fileType === 'todo') {
      content = JSON.stringify([], null, 2)
    } else {
      content = `# ${title}\n\n`
    }

    fs.writeFileSync(filePath, content, 'utf-8')

    return {
      name: fileName,
      filePath,
      content,
      fileType,
    }
  }

  async readNote(notePath: string): Promise<string> {
    if (!fs.existsSync(notePath)) {
      throw new Error('Note file not found')
    }
    return fs.readFileSync(notePath, 'utf-8')
  }

  async readKeyEntries(notePath: string): Promise<{ entries: KeyEntry[]; locked: boolean }> {
    const raw = await this.readNote(notePath)
    const data = JSON.parse(raw)
    const entries = Array.isArray(data) ? data : data.entries || []
    const locked = data.locked === true

    return { entries, locked }
  }

  async readDecryptedKeyEntries(notePath: string): Promise<KeyEntry[]> {
    const { entries } = await this.readKeyEntries(notePath)
    return this.crypto.decryptEntries(entries)
  }

  async lockNoteFile(notePath: string, password: string): Promise<string> {
    if (!notePath.endsWith('.anemona-key')) throw new Error('Not a key file')
    const content = fs.readFileSync(notePath, 'utf-8')
    const encrypted = this.crypto.encryptFileContent(content, password)
    const lockPath = notePath.replace(/\.anemona-key$/, '.anemona-lock')
    fs.writeFileSync(lockPath, encrypted, 'utf-8')
    fs.unlinkSync(notePath)
    return lockPath
  }

  async unlockNoteFile(notePath: string, password: string): Promise<string | null> {
    if (!notePath.endsWith('.anemona-lock')) throw new Error('Not a lock file')
    const encrypted = fs.readFileSync(notePath, 'utf-8')
    const decrypted = this.crypto.decryptFileContent(encrypted, password)
    if (!decrypted) return null
    const keyPath = notePath.replace(/\.anemona-lock$/, '.anemona-key')
    fs.writeFileSync(keyPath, decrypted, 'utf-8')
    fs.unlinkSync(notePath)
    return keyPath
  }

  async saveKeyEntries(notePath: string, entries: KeyEntry[], locked: boolean): Promise<void> {
    let encrypted: KeyEntry[]

    try {
      encrypted = this.crypto.encryptEntries(entries)
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'Vault is locked. Enter your password to unlock.' &&
        this.crypto.isUsingPasswordMode() &&
        this.isEmptyKeyFile(notePath)
      ) {
        this.crypto.resetToPlainKey()
        encrypted = this.crypto.encryptEntries(entries)
      } else {
        throw err
      }
    }

    const data = { entries: encrypted, locked }
    fs.writeFileSync(notePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async readCommandEntries(notePath: string): Promise<CommandEntry[]> {
    const raw = await this.readNote(notePath)
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  }

  async saveCommandEntries(notePath: string, entries: CommandEntry[]): Promise<void> {
    fs.writeFileSync(notePath, JSON.stringify(entries, null, 2), 'utf-8')
  }

  async readTodoEntries(notePath: string): Promise<TodoEntry[]> {
    const raw = await this.readNote(notePath)
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []

    return data.map((entry) => ({
      title: String(entry?.title || '').trim(),
      progress: Math.max(0, Math.min(100, Number(entry?.progress) || 0)),
      status: entry?.status === 'done' || entry?.status === 'cancelled' ? entry.status : 'open',
      priority: entry?.priority === 'low' || entry?.priority === 'high' ? entry.priority : 'medium',
      dueAt: this.normalizeTodoDueAt(entry?.dueAt),
    }))
  }

  async saveTodoEntries(notePath: string, entries: TodoEntry[]): Promise<void> {
    const normalized = entries.map((entry) => ({
      title: String(entry.title || '').trim(),
      progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
      status: entry.status === 'done' || entry.status === 'cancelled' ? entry.status : 'open',
      priority: entry.priority === 'low' || entry.priority === 'high' ? entry.priority : 'medium',
      dueAt: this.normalizeTodoDueAt(entry.dueAt),
    }))

    fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8')
  }

  private normalizeTodoDueAt(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined

    const trimmed = value.trim()
    if (!trimmed) return undefined

    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed) ? trimmed : undefined
  }

  async saveNote(notePath: string, content: string): Promise<void> {
    if (!fs.existsSync(notePath)) {
      throw new Error('Note file not found')
    }
    fs.writeFileSync(notePath, content, 'utf-8')
  }

  async deleteNote(notePath: string): Promise<void> {
    if (!fs.existsSync(notePath)) {
      throw new Error('Note file not found')
    }
    fs.unlinkSync(notePath)
  }

  async renameNote(notePath: string, newTitle: string): Promise<string> {
    if (!fs.existsSync(notePath)) {
      throw new Error('Note file not found')
    }

    const trimmed = newTitle.trim()
    if (!trimmed) {
      throw new Error('Name is required')
    }

    const dirPath = path.dirname(notePath)
    const ext = this.detectFullExtension(path.basename(notePath))
    const newPath = path.join(dirPath, this.sanitizePathName(trimmed) + ext)

    if (newPath === notePath) {
      return notePath
    }

    if (fs.existsSync(newPath)) {
      throw new Error(`Note "${trimmed}" already exists`)
    }

    fs.renameSync(notePath, newPath)
    return newPath
  }

  async createCategory(name: string): Promise<void> {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(name))

    if (fs.existsSync(categoryPath)) {
      throw new Error(`Category "${name}" already exists`)
    }

    fs.mkdirSync(categoryPath, { recursive: true })

    const configPath = path.join(categoryPath, '.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ color: this.defaultCategoryColor }, null, 2), 'utf-8')
  }

  async renameCategory(categoryName: string, newName: string): Promise<string> {
    const rootPath = this.ensureStoragePath()
    const currentPath = path.join(rootPath, this.sanitizePathName(categoryName))

    if (!fs.existsSync(currentPath)) {
      throw new Error('Category not found')
    }

    const trimmed = newName.trim()
    if (!trimmed) {
      throw new Error('Name is required')
    }

    const newPath = path.join(rootPath, this.sanitizePathName(trimmed))
    if (newPath === currentPath) {
      return path.basename(currentPath)
    }

    if (fs.existsSync(newPath)) {
      throw new Error(`Category "${trimmed}" already exists`)
    }

    fs.renameSync(currentPath, newPath)
    return path.basename(newPath)
  }

  canDeleteCategory(categoryName: string): boolean {
    return this.canDeleteCategorySync(categoryName)
  }

  async deleteCategory(categoryName: string): Promise<void> {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName))

    if (!fs.existsSync(categoryPath)) {
      throw new Error('Category not found')
    }

    if (!this.canDeleteCategorySync(categoryName)) {
      throw new Error('Category must be empty before deleting')
    }

    const configPath = path.join(categoryPath, '.config.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }

    fs.rmdirSync(categoryPath)
  }

  private isEmptyKeyFile(notePath: string): boolean {
    if (!fs.existsSync(notePath)) {
      return true
    }

    try {
      const raw = fs.readFileSync(notePath, 'utf-8').trim()
      if (!raw) return true

      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        return data.length === 0
      }

      if (data && typeof data === 'object') {
        const entries = Array.isArray((data as { entries?: unknown[] }).entries)
          ? (data as { entries: unknown[] }).entries
          : []
        return entries.length === 0
      }
    } catch {
      return false
    }

    return false
  }

  private canDeleteCategorySync(categoryName: string): boolean {
    const rootPath = this.ensureStoragePath()
    const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName))

    if (!fs.existsSync(categoryPath)) {
      return false
    }

    const entries = fs.readdirSync(categoryPath, { withFileTypes: true })
    return entries.every((entry) => entry.isFile() && entry.name === '.config.json')
  }

  private detectFullExtension(fileName: string): string {
    if (fileName.endsWith('.anemona-lock')) return '.anemona-lock'
    if (fileName.endsWith('.anemona-key')) return '.anemona-key'
    if (fileName.endsWith('.anemona-command')) return '.anemona-command'
    if (fileName.endsWith('.anemona-todo')) return '.anemona-todo'
    if (fileName.endsWith('.md')) return '.md'
    return path.extname(fileName)
  }

  private sanitizePathName(name: string): string {
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/\.\./g, '')
  }
}
