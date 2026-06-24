import * as vscode from 'vscode'
import { randomBytes } from 'crypto'
import { NotificationRepository } from './NotificationRepository'
import type { VaultNotification, NotificationType, NotificationAction, HistoryIndex, NotificationConfig } from './NotificationTypes'

export class NotificationService {
  constructor(private repository: NotificationRepository) {}

  private generateId(): string {
    const hex = randomBytes(16).toString('hex')
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      '4' + hex.slice(13, 16),
      '8' + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join('-')
  }

  private buildKey(type: NotificationType, relatedItemId?: string): string {
    return relatedItemId ? `${type}:${relatedItemId}` : `${type}:${this.generateId()}`
  }

  createIfNotExists(
    type: NotificationType,
    priority: 'low' | 'normal' | 'high',
    title: string,
    message: string,
    options?: {
      relatedItemId?: string
      relatedItemType?: 'task' | 'reminder' | 'system'
      action?: NotificationAction
      key?: string
    }
  ): VaultNotification | null {
    const key = options?.key ?? this.buildKey(type, options?.relatedItemId)

    if (this.repository.keyExists(key)) {
      return null
    }

    const notification: VaultNotification = {
      id: this.generateId(),
      key,
      type,
      title,
      message,
      source: 'local',
      status: 'unread',
      priority,
      relatedItemId: options?.relatedItemId,
      relatedItemType: options?.relatedItemType ?? (options?.relatedItemId ? 'task' : 'system'),
      action: options?.action,
      createdAt: new Date().toISOString(),
    }

    this.repository.addKey(key)
    this.repository.addToInbox(notification)
    return notification
  }

  createAndShow(
    type: NotificationType,
    priority: 'low' | 'normal' | 'high',
    title: string,
    message: string,
    options?: {
      relatedItemId?: string
      relatedItemType?: 'task' | 'reminder' | 'system'
      action?: NotificationAction
      key?: string
    }
  ): VaultNotification | null {
    const notification = this.createIfNotExists(type, priority, title, message, options)
    if (notification) {
      const display = notification.message
        ? `${notification.title}: ${notification.message}`
        : notification.title
      if (priority === 'high') {
        vscode.window.showWarningMessage(display)
      } else {
        vscode.window.showInformationMessage(display)
      }
    }
    return notification
  }

  markRead(id: string): void {
    this.repository.markRead(id)
  }

  markUnread(id: string): void {
    this.repository.markUnread(id)
  }

  deleteNotification(id: string): boolean {
    return this.repository.deleteFromHistory(id)
  }

  removeFromInbox(key: string): void {
    this.repository.removeFromInboxByKey(key)
  }

  getInbox(): VaultNotification[] {
    return this.repository.getInbox()
  }

  getHistoryPage(pageNum: number): VaultNotification[] {
    return this.repository.getHistoryPage(pageNum)
  }

  getHistoryIndex(): HistoryIndex {
    return this.repository.getHistoryIndex()
  }

  getConfig(): NotificationConfig {
    return this.repository.getConfig()
  }

  updateConfig(config: NotificationConfig): void {
    this.repository.updateConfig(config)
  }

  getAll(): VaultNotification[] {
    return this.repository.getAll()
  }

  getPendingCount(): number {
    return this.repository.getPendingCount()
  }

  keyExists(key: string): boolean {
    return this.repository.keyExists(key)
  }

  removeGeneratedKey(key: string): boolean {
    return this.repository.removeGeneratedKey(key)
  }

  removeGeneratedKeysByPrefix(prefix: string): number {
    return this.repository.removeGeneratedKeysByPrefix(prefix)
  }

  reload(): void {
    this.repository.reload()
  }

  setLastCheckAt(iso: string): void {
    this.repository.setLastCheckAt(iso)
  }

  getLastCheckAt(): string | null {
    return this.repository.getLastCheckAt()
  }
}
