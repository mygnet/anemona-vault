export type NotificationStatus = 'unread' | 'read'

export type NotificationType = 'task_due_soon' | 'task_overdue' | 'task_due' | 'reminder' | 'system'

export interface NotificationAction {
  type: 'task' | 'file' | 'url' | 'command' | 'system'
  target: string
}

export interface VaultNotification {
  id: string
  key: string
  type: NotificationType
  title: string
  message: string
  source: 'local'
  status: NotificationStatus
  priority: 'low' | 'normal' | 'high'
  relatedItemId?: string
  relatedItemType?: 'task' | 'reminder' | 'system'
  action?: NotificationAction
  createdAt: string
  readAt?: string | null
}

export interface NotificationIndex {
  version: number
  lastCheckAt: string | null
  generatedKeys: string[]
}

export interface HistoryIndex {
  version: number
  pageSize: number
  currentPage: number
  currentFile: string
  totalPages: number
  totalNotifications: number
  lastUpdatedAt: string
}

export type ScheduledEventSource = 'reminder' | 'task'

export type ScheduledEventStatus = 'pending' | 'notified' | 'completed' | 'cancelled'

export interface ScheduledEvent {
  id: string
  source: ScheduledEventSource
  sourceFile: string
  sourceFileName: string
  sourceId: string
  dueAt: string
  notificationKey: string
  status: ScheduledEventStatus
  title: string
  message: string
  createdAt: string
  updatedAt: string
}

export interface ScheduledEventsCacheData {
  version: number
  updatedAt: string
  events: ScheduledEvent[]
}

export interface TaskInfo {
  id: string
  title: string
  dueAt?: string
  status: 'open' | 'done' | 'cancelled'
  notePath: string
}

export interface TaskProvider {
  getTasks(): TaskInfo[]
}
