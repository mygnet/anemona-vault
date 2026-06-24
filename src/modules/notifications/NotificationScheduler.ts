import { NotificationService } from './NotificationService'
import { ScheduledEventsCache } from './ScheduledEventsCache'
import type { ScheduledEventsCacheData } from './NotificationTypes'

export class NotificationScheduler {
  private timer: NodeJS.Timeout | null = null
  private refreshIntervalMs: number
  private tickIntervalMs: number
  private lastReloadAt = 0
  private lastTickAt = 0
  private cacheData: ScheduledEventsCacheData | null = null

  constructor(
    private scheduledEventsCache: ScheduledEventsCache,
    private notificationService: NotificationService,
    private config: { checkIntervalMinutes: number; dueSoonHours: number; tickIntervalSeconds?: number },
    private onNotificationsChanged?: () => void,
    private onPeriodicReminder?: (sourceFile: string, sourceId: string, dueAt: string, interval: { unit: string; value: number }) => void,
  ) {
    this.refreshIntervalMs = config.checkIntervalMinutes * 60 * 1000
    this.tickIntervalMs = (config.tickIntervalSeconds || 5) * 1000
    this.scheduledEventsCache.setOnDidChange(() => this.reloadCache())
  }

  start(): void {
    this.reloadCache()
    this.check()
    this.timer = setInterval(() => this.check(), this.tickIntervalMs)
    console.log(`[Scheduler] started — tick interval: ${this.tickIntervalMs}ms, refresh: ${this.refreshIntervalMs}ms`)
  }

  reloadCache(): void {
    this.cacheData = this.scheduledEventsCache.loadOrCreate()
    this.lastReloadAt = Date.now()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  check(): void {
    const now = new Date()
    const nowMs = now.getTime()
    if (this.lastTickAt > 0) {
      const elapsed = nowMs - this.lastTickAt
      if (elapsed > this.tickIntervalMs * 1.5) {
        console.log(`[Scheduler] tick delayed: ${elapsed}ms (expected ~${this.tickIntervalMs}ms)`)
      }
    }
    this.lastTickAt = nowMs

    if (!this.cacheData || nowMs - this.lastReloadAt >= this.refreshIntervalMs) {
      this.reloadCache()
    }

    const cache = this.cacheData
    if (!cache) return

    let changed = false

    for (const event of cache.events) {
      if (event.status !== 'pending') continue

      const dueDate = new Date(event.dueAt)
      if (isNaN(dueDate.getTime())) continue

      const dueMinute = Math.floor(dueDate.getTime() / 60000) * 60000
      const nowMinute = Math.floor(now.getTime() / 60000) * 60000
      if (dueMinute > nowMinute) continue

      const dueSoonMs = this.config.dueSoonHours * 60 * 60 * 1000
      const notificationType = event.source === 'reminder'
        ? 'reminder'
        : dueDate.getTime() <= now.getTime()
          ? 'task_overdue'
          : dueDate.getTime() - now.getTime() <= dueSoonMs
            ? 'task_due_soon'
            : 'task_due'

      let created = this.notificationService.createAndShow(
        notificationType,
        'normal',
        event.title || (event.source === 'reminder' ? 'Recordatorio' : 'Tarea pendiente'),
        event.message || '',
        {
          key: event.notificationKey,
          relatedItemId: event.sourceId,
          relatedItemType: event.source,
          action: { type: 'file', target: event.sourceFile },
        },
      )

      if (!created && this.notificationService.keyExists(event.notificationKey)) {
        this.notificationService.removeGeneratedKey(event.notificationKey)
        this.notificationService.removeFromInbox(event.notificationKey)
        created = this.notificationService.createAndShow(
            notificationType,
            'normal',
            event.title || (event.source === 'reminder' ? 'Recordatorio' : 'Tarea pendiente'),
            event.message || '',
          {
            key: event.notificationKey,
            relatedItemId: event.sourceId,
            relatedItemType: event.source,
            action: { type: 'file', target: event.sourceFile },
          },
        )
      }

      if (created) {
        event.status = 'notified'
        event.updatedAt = now.toISOString()
        changed = true
        if (event.interval && this.onPeriodicReminder) {
          this.onPeriodicReminder(event.sourceFile, event.sourceId, event.dueAt, event.interval)
        }
      }
    }

    if (changed) {
      this.scheduledEventsCache.save(cache)
      this.onNotificationsChanged?.()
    }
  }
}
