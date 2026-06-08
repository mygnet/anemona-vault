export interface Note {
  name: string
  filePath: string
  content: string
  fileType: FileType
}

export type FileType = 'md' | 'key' | 'command' | 'todo'

export interface CategoryConfig {
  color?: string
  icon?: string
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
}

export interface CommandEntry {
  title: string
  command: string
}

export interface TodoEntry {
  title: string
  progress: number
  status: 'open' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  dueAt?: string
}

export interface KeyFileData {
  entries: KeyEntry[]
  locked: boolean
}

export interface VaultState {
  unlocked: boolean
  passwordHash?: string
}

export interface WebviewMessage {
  command: string
  [key: string]: unknown
}
