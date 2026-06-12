export interface Note {
  name: string
  filePath: string
  content: string
  fileType: FileType
}

export type FileType = 'md' | 'key' | 'command' | 'todo' | 'snippet'

export interface CategoryConfig {
  color?: string
  icon?: string
  file?: Record<string, { progress?: number }>
}

export interface Category {
  name: string
  path: string
  notes: Note[]
  config?: CategoryConfig
  canDelete?: boolean
}

export interface KeyEntry {
  title: string
  password: string
  note?: string
  url?: string
  email?: string
  username?: string
  host?: string
  port?: string
  token?: string
}

export interface CommandEntry {
  title: string
  command: string
}

export interface TodoEntry {
  id?: string
  title: string
  progress: number
  status: 'open' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  dueAt?: string
}

export interface SnippetEntry {
  title: string
  language: string
  code: string
}

export interface GlobalSearchResult {
  category: string
  noteName: string
  filePath: string
  fileType: FileType
  displayName: string
  matchLabel: string
  snippet: string
}

export interface KeyFileData {
  entries: KeyEntry[]
  locked: boolean
}

export interface VaultState {
  unlocked: boolean
  passwordHash?: string
}

export interface FolderBrief {
  name: string
  path: string
  color?: string
  isEmpty?: boolean
}

export interface FolderTreeNode {
  name: string
  path: string
  children: FolderTreeNode[]
}

export interface RecentFolderData {
  path: string
  name: string
  icon?: string
  lastOpened: string
}

export interface WebviewMessage {
  command: string
  [key: string]: unknown
}
