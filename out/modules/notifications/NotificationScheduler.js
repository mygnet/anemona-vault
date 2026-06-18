"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationScheduler = void 0;
class NotificationScheduler {
    constructor(scheduledEventsCache, notificationService, config, onNotificationsChanged) {
        this.scheduledEventsCache = scheduledEventsCache;
        this.notificationService = notificationService;
        this.config = config;
        this.onNotificationsChanged = onNotificationsChanged;
        this.timer = null;
        this.lastReloadAt = 0;
        this.lastTickAt = 0;
        this.cacheData = null;
        this.refreshIntervalMs = config.checkIntervalMinutes * 60 * 1000;
        this.tickIntervalMs = (config.tickIntervalSeconds || 5) * 1000;
        this.scheduledEventsCache.setOnDidChange(() => this.reloadCache());
    }
    start() {
        this.reloadCache();
        this.check();
        this.timer = setInterval(() => this.check(), this.tickIntervalMs);
        console.log(`[Scheduler] started — tick interval: ${this.tickIntervalMs}ms, refresh: ${this.refreshIntervalMs}ms`);
    }
    reloadCache() {
        this.cacheData = this.scheduledEventsCache.loadOrCreate();
        this.lastReloadAt = Date.now();
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    check() {
        const now = new Date();
        const nowMs = now.getTime();
        if (this.lastTickAt > 0) {
            const elapsed = nowMs - this.lastTickAt;
            if (elapsed > this.tickIntervalMs * 1.5) {
                console.log(`[Scheduler] tick delayed: ${elapsed}ms (expected ~${this.tickIntervalMs}ms)`);
            }
        }
        this.lastTickAt = nowMs;
        if (!this.cacheData || nowMs - this.lastReloadAt >= this.refreshIntervalMs) {
            this.reloadCache();
        }
        const cache = this.cacheData;
        if (!cache)
            return;
        let changed = false;
        for (const event of cache.events) {
            if (event.status !== 'pending')
                continue;
            const dueDate = new Date(event.dueAt);
            if (isNaN(dueDate.getTime()))
                continue;
            const dueMinute = Math.floor(dueDate.getTime() / 60000) * 60000;
            const nowMinute = Math.floor(now.getTime() / 60000) * 60000;
            if (dueMinute > nowMinute)
                continue;
            let created = this.notificationService.createAndShow(event.source === 'reminder' ? 'reminder' : 'task_due', 'normal', event.title || (event.source === 'reminder' ? 'Recordatorio' : 'Tarea pendiente'), event.message || '', {
                key: event.notificationKey,
                relatedItemId: event.sourceId,
                relatedItemType: event.source,
                action: { type: 'file', target: event.sourceFile },
            });
            if (!created && this.notificationService.keyExists(event.notificationKey)) {
                this.notificationService.removeGeneratedKey(event.notificationKey);
                this.notificationService.removeFromInbox(event.notificationKey);
                created = this.notificationService.createAndShow(event.source === 'reminder' ? 'reminder' : 'task_due', 'normal', event.title || (event.source === 'reminder' ? 'Recordatorio' : 'Tarea pendiente'), event.message || '', {
                    key: event.notificationKey,
                    relatedItemId: event.sourceId,
                    relatedItemType: event.source,
                    action: { type: 'file', target: event.sourceFile },
                });
            }
            if (created) {
                event.status = 'notified';
                event.updatedAt = now.toISOString();
                changed = true;
            }
        }
        if (changed) {
            this.scheduledEventsCache.save(cache);
            this.onNotificationsChanged?.();
        }
    }
}
exports.NotificationScheduler = NotificationScheduler;
//# sourceMappingURL=NotificationScheduler.js.map