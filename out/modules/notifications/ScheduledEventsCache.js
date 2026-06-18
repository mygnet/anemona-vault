"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduledEventsCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CACHE_VERSION = 2;
class ScheduledEventsCache {
    constructor(storagePath) {
        this.onDidChange = null;
        this.storagePath = storagePath;
    }
    setStoragePath(newPath) {
        this.storagePath = newPath;
        this.rebuild();
    }
    setOnDidChange(callback) {
        this.onDidChange = callback;
    }
    get cacheDir() {
        return path.join(this.storagePath, '.anemona', 'cache');
    }
    get cachePath() {
        return path.join(this.cacheDir, 'scheduled-events.json');
    }
    ensureDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    now() {
        return new Date().toISOString();
    }
    toRelative(filePath) {
        return path.relative(this.storagePath, filePath).split(path.sep).join('/');
    }
    resolveSourceFile(sourceFile) {
        return path.isAbsolute(sourceFile) ? sourceFile : path.join(this.storagePath, sourceFile);
    }
    exists() {
        return fs.existsSync(this.cachePath);
    }
    loadOrCreate() {
        if (!this.exists()) {
            return this.rebuild();
        }
        try {
            const raw = fs.readFileSync(this.cachePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.events)) {
                return this.rebuild();
            }
            return parsed;
        }
        catch {
            return this.rebuild();
        }
    }
    save(data) {
        this.ensureDir();
        fs.writeFileSync(this.cachePath, JSON.stringify({ ...data, updatedAt: this.now() }, null, 2), 'utf-8');
        this.onDidChange?.();
    }
    rebuild() {
        const now = this.now();
        const events = [];
        for (const filePath of this.listEventFiles(this.storagePath)) {
            for (const event of this.extractEventsFromFile(filePath)) {
                events.push({ ...event, createdAt: now, updatedAt: now });
            }
        }
        const data = { version: CACHE_VERSION, updatedAt: now, events };
        this.save(data);
        return data;
    }
    syncFile(filePath) {
        if (!this.isEventFile(filePath))
            return;
        const data = this.loadOrCreate();
        const rel = this.toRelative(filePath);
        const now = this.now();
        const extracted = fs.existsSync(filePath) ? this.extractEventsFromFile(filePath) : [];
        const extractedById = new Map(extracted.map(event => [event.id, event]));
        const next = [];
        for (const existing of data.events) {
            if (existing.sourceFile !== rel) {
                next.push(existing);
                continue;
            }
            const current = extractedById.get(existing.id);
            if (!current) {
                next.push({ ...existing, status: 'cancelled', updatedAt: now });
                continue;
            }
            const changed = existing.dueAt !== current.dueAt || existing.title !== current.title || existing.message !== current.message;
            const status = current.status === 'pending'
                ? (changed ? 'pending' : existing.status === 'notified' ? 'notified' : 'pending')
                : current.status;
            next.push({
                ...existing,
                ...current,
                status,
                createdAt: existing.createdAt,
                updatedAt: changed || existing.status !== status ? now : existing.updatedAt,
            });
            extractedById.delete(existing.id);
        }
        for (const event of extractedById.values()) {
            next.push({ ...event, createdAt: now, updatedAt: now });
        }
        this.save({ ...data, events: next });
    }
    cancelFile(filePath) {
        const data = this.loadOrCreate();
        const rel = this.toRelative(filePath);
        const now = this.now();
        this.save({
            ...data,
            events: data.events.map(event => event.sourceFile === rel ? { ...event, status: 'cancelled', updatedAt: now } : event),
        });
    }
    listEventFiles(dirPath) {
        const result = [];
        if (!fs.existsSync(dirPath))
            return result;
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            if (entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                result.push(...this.listEventFiles(fullPath));
            }
            else if (entry.isFile() && this.isEventFile(fullPath)) {
                result.push(fullPath);
            }
        }
        return result;
    }
    isEventFile(filePath) {
        return filePath.endsWith('.anemona-reminder') || filePath.endsWith('.anemona-todo');
    }
    extractEventsFromFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8').trim();
            if (!raw)
                return [];
            const entries = JSON.parse(raw);
            if (!Array.isArray(entries))
                return [];
            return filePath.endsWith('.anemona-reminder')
                ? this.extractReminderEvents(filePath, entries)
                : this.extractTaskEvents(filePath, entries);
        }
        catch {
            return [];
        }
    }
    buildEvent(filePath, source, sourceId, dueAt, title, message, status) {
        const rel = this.toRelative(filePath);
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
        };
    }
    extractReminderEvents(filePath, entries) {
        const result = [];
        for (const entry of entries) {
            const id = String(entry?.id || '').trim();
            const dueAt = typeof entry?.dueAt === 'string' ? entry.dueAt.trim() : '';
            if (!id || !dueAt)
                continue;
            const status = entry?.status === 'completed' ? 'completed' : 'pending';
            const text = String(entry?.text || '').trim();
            const title = String(entry?.title || '').trim() || this.deriveTitle(text) || 'Recordatorio';
            result.push(this.buildEvent(filePath, 'reminder', id, dueAt, title, text, status));
        }
        return result;
    }
    extractTaskEvents(filePath, entries) {
        const result = [];
        for (const entry of entries) {
            const id = String(entry?.id || '').trim();
            const dueAt = typeof entry?.dueAt === 'string' ? entry.dueAt.trim() : '';
            if (!id || !dueAt)
                continue;
            const status = entry?.status === 'done'
                ? 'completed'
                : entry?.status === 'cancelled'
                    ? 'cancelled'
                    : 'pending';
            const title = String(entry?.title || '').trim() || 'Tarea pendiente';
            const message = String(entry?.text || '').trim();
            result.push(this.buildEvent(filePath, 'task', id, dueAt, title, message, status));
        }
        return result;
    }
    deriveTitle(text) {
        return text.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
    }
}
exports.ScheduledEventsCache = ScheduledEventsCache;
//# sourceMappingURL=ScheduledEventsCache.js.map