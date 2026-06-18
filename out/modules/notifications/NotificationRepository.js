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
exports.NotificationRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const INDEX_VERSION = 1;
const HISTORY_INDEX_VERSION = 1;
const PAGE_SIZE = 100;
class NotificationRepository {
    constructor(storagePath) {
        this.inbox = [];
        this.index = { version: INDEX_VERSION, lastCheckAt: null, generatedKeys: [] };
        this.historyIndex = { version: HISTORY_INDEX_VERSION, pageSize: PAGE_SIZE, currentPage: 0, currentFile: '', totalPages: 0, totalNotifications: 0, lastUpdatedAt: '' };
        this.storagePath = storagePath;
        this.load();
        this.migrateFromLegacyHistory();
    }
    setStoragePath(newPath) {
        this.storagePath = newPath;
        this.inbox = [];
        this.index = { version: INDEX_VERSION, lastCheckAt: null, generatedKeys: [] };
        this.historyIndex = { version: HISTORY_INDEX_VERSION, pageSize: PAGE_SIZE, currentPage: 0, currentFile: '', totalPages: 0, totalNotifications: 0, lastUpdatedAt: '' };
        this.load();
        this.migrateFromLegacyHistory();
    }
    get baseDir() {
        return path.join(this.storagePath, '.anemona', 'notifications');
    }
    get historyDir() {
        return path.join(this.baseDir, 'history');
    }
    ensureDir() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }
    ensureHistoryDir() {
        if (!fs.existsSync(this.historyDir)) {
            fs.mkdirSync(this.historyDir, { recursive: true });
        }
    }
    now() {
        return new Date().toISOString();
    }
    loadFile(fileName, fallback) {
        const fp = path.join(this.baseDir, fileName);
        try {
            if (fs.existsSync(fp)) {
                const raw = fs.readFileSync(fp, 'utf-8');
                return JSON.parse(raw);
            }
        }
        catch {
            // ignore
        }
        return fallback;
    }
    loadHistoryFile(fileName, fallback) {
        const fp = path.join(this.historyDir, fileName);
        try {
            if (fs.existsSync(fp)) {
                const raw = fs.readFileSync(fp, 'utf-8');
                return JSON.parse(raw);
            }
        }
        catch {
            // ignore
        }
        return fallback;
    }
    writeFile(fileName, data) {
        this.ensureDir();
        fs.writeFileSync(path.join(this.baseDir, fileName), JSON.stringify(data, null, 2), 'utf-8');
    }
    writeHistoryFile(fileName, data) {
        this.ensureHistoryDir();
        fs.writeFileSync(path.join(this.historyDir, fileName), JSON.stringify(data, null, 2), 'utf-8');
    }
    pageFileName(pageNum) {
        return `page-${String(pageNum).padStart(4, '0')}.json`;
    }
    sortNewestFirst(notifications) {
        return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    sameJson(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    reload() {
        this.load();
    }
    migrateFromLegacyHistory() {
        const legacyPath = path.join(this.baseDir, 'history.json');
        if (!fs.existsSync(legacyPath))
            return;
        try {
            const raw = fs.readFileSync(legacyPath, 'utf-8');
            const legacy = JSON.parse(raw);
            if (!Array.isArray(legacy) || legacy.length === 0) {
                fs.unlinkSync(legacyPath);
                return;
            }
            legacy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            for (const notification of legacy) {
                this.appendToHistory(notification);
            }
            fs.unlinkSync(legacyPath);
        }
        catch {
            // skip migration on error
        }
    }
    load() {
        this.inbox = this.loadFile('inbox.json', []);
        this.index = this.loadFile('index.json', {
            version: INDEX_VERSION,
            lastCheckAt: null,
            generatedKeys: [],
        });
        this.historyIndex = this.loadHistoryFile('index.json', {
            version: HISTORY_INDEX_VERSION,
            pageSize: PAGE_SIZE,
            currentPage: 0,
            currentFile: '',
            totalPages: 0,
            totalNotifications: 0,
            lastUpdatedAt: '',
        });
        this.rebuildIndexAndRemoveDuplicates();
        this.normalizeHistoryPages();
    }
    rebuildIndexAndRemoveDuplicates() {
        const seen = new Set();
        const normalize = (items) => items.filter((notification) => {
            const key = notification.key;
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        const inbox = normalize(this.inbox);
        const changed = inbox.length !== this.inbox.length;
        this.inbox = inbox;
        this.index.generatedKeys = Array.from(new Set([
            ...this.index.generatedKeys.filter(Boolean),
            ...inbox.map(n => n.key),
        ]));
        if (changed) {
            this.saveInbox();
            this.writeFile('index.json', this.index);
        }
    }
    saveInbox() {
        this.inbox = this.sortNewestFirst(this.inbox);
        this.writeFile('inbox.json', this.inbox);
    }
    saveHistoryIndex() {
        this.historyIndex.lastUpdatedAt = this.now();
        this.writeHistoryFile('index.json', this.historyIndex);
    }
    keyExists(key) {
        return this.index.generatedKeys.includes(key);
    }
    addKey(key) {
        if (!this.index.generatedKeys.includes(key)) {
            this.index.generatedKeys.push(key);
            this.writeFile('index.json', this.index);
        }
    }
    removeGeneratedKey(key) {
        const idx = this.index.generatedKeys.indexOf(key);
        if (idx === -1)
            return false;
        this.index.generatedKeys.splice(idx, 1);
        this.writeFile('index.json', this.index);
        return true;
    }
    removeGeneratedKeysByPrefix(prefix) {
        const before = this.index.generatedKeys.length;
        this.index.generatedKeys = this.index.generatedKeys.filter(k => !k.startsWith(prefix));
        const removed = before - this.index.generatedKeys.length;
        if (removed > 0) {
            this.writeFile('index.json', this.index);
        }
        return removed;
    }
    addToInbox(notification) {
        if (this.inbox.some(n => n.key === notification.key))
            return;
        this.inbox.unshift(notification);
        this.saveInbox();
    }
    loadHistoryPage(pageNum) {
        return this.sortNewestFirst(this.loadHistoryFile(this.pageFileName(pageNum), []));
    }
    saveHistoryPage(pageNum, notifications) {
        this.writeHistoryFile(this.pageFileName(pageNum), this.sortNewestFirst(notifications));
    }
    normalizeHistoryPages() {
        if (this.historyIndex.totalPages <= 0)
            return;
        const all = [];
        for (let p = 1; p <= this.historyIndex.totalPages; p++) {
            all.push(...this.loadHistoryPage(p));
        }
        const orderedOldestFirst = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const totalPages = Math.ceil(orderedOldestFirst.length / PAGE_SIZE);
        const currentFile = totalPages > 0 ? this.pageFileName(totalPages) : '';
        let changed = this.historyIndex.currentPage !== totalPages ||
            this.historyIndex.currentFile !== currentFile ||
            this.historyIndex.totalPages !== totalPages ||
            this.historyIndex.totalNotifications !== orderedOldestFirst.length;
        for (let p = 1; p <= totalPages; p++) {
            const start = (p - 1) * PAGE_SIZE;
            const pageItems = this.sortNewestFirst(orderedOldestFirst.slice(start, start + PAGE_SIZE));
            const currentItems = this.loadHistoryFile(this.pageFileName(p), []);
            if (!this.sameJson(currentItems, pageItems)) {
                this.saveHistoryPage(p, pageItems);
                changed = true;
            }
        }
        for (let p = totalPages + 1; p <= this.historyIndex.totalPages; p++) {
            const filePath = path.join(this.historyDir, this.pageFileName(p));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                changed = true;
            }
        }
        if (changed) {
            this.historyIndex.currentPage = totalPages;
            this.historyIndex.currentFile = currentFile;
            this.historyIndex.totalPages = totalPages;
            this.historyIndex.totalNotifications = orderedOldestFirst.length;
            this.saveHistoryIndex();
        }
    }
    moveToHistory(id, status) {
        const idx = this.inbox.findIndex(n => n.id === id);
        if (idx === -1)
            return null;
        const [notification] = this.inbox.splice(idx, 1);
        notification.status = status;
        this.saveInbox();
        this.appendToHistory(notification);
        return notification;
    }
    appendToHistory(notification) {
        let page = this.historyIndex.currentPage;
        let notifications = [];
        if (page > 0) {
            notifications = this.loadHistoryPage(page);
        }
        if (notifications.length >= PAGE_SIZE) {
            page++;
            notifications = [];
        }
        notifications.push(notification);
        notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (page === 0)
            page = 1;
        this.historyIndex.currentPage = page;
        this.historyIndex.currentFile = this.pageFileName(page);
        this.historyIndex.totalPages = page;
        this.historyIndex.totalNotifications++;
        this.saveHistoryPage(page, notifications);
        this.saveHistoryIndex();
    }
    findInHistoryPages(id) {
        for (let p = 1; p <= this.historyIndex.totalPages; p++) {
            const items = this.loadHistoryPage(p);
            const idx = items.findIndex(n => n.id === id);
            if (idx !== -1)
                return { page: p, items, index: idx };
        }
        return null;
    }
    markRead(id) {
        const n = this.moveToHistory(id, 'read');
        if (n) {
            n.readAt = new Date().toISOString();
            this.updateReadAt(n);
        }
        return n;
    }
    updateReadAt(notification) {
        for (let p = 1; p <= this.historyIndex.totalPages; p++) {
            const items = this.loadHistoryPage(p);
            const idx = items.findIndex(n => n.id === notification.id);
            if (idx !== -1) {
                items[idx] = notification;
                this.saveHistoryPage(p, items);
                return;
            }
        }
    }
    markUnread(id) {
        const found = this.findInHistoryPages(id);
        if (!found)
            return null;
        const [notification] = found.items.splice(found.index, 1);
        notification.status = 'unread';
        notification.readAt = null;
        this.saveHistoryPage(found.page, found.items);
        this.historyIndex.totalNotifications--;
        this.saveHistoryIndex();
        this.inbox.push(notification);
        this.saveInbox();
        return notification;
    }
    deleteFromHistory(id) {
        const found = this.findInHistoryPages(id);
        if (!found)
            return false;
        found.items.splice(found.index, 1);
        this.saveHistoryPage(found.page, found.items);
        this.historyIndex.totalNotifications--;
        this.saveHistoryIndex();
        return true;
    }
    removeFromInboxByKey(key) {
        const before = this.inbox.length;
        this.inbox = this.inbox.filter(n => n.key !== key);
        if (this.inbox.length !== before) {
            this.saveInbox();
        }
    }
    getInbox() {
        return [...this.inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getHistoryPage(pageNum) {
        return this.loadHistoryPage(pageNum);
    }
    getHistoryIndex() {
        return { ...this.historyIndex };
    }
    getAll() {
        if (this.historyIndex.totalPages === 0)
            return [...this.inbox];
        const history = [];
        for (let p = 1; p <= this.historyIndex.totalPages; p++) {
            history.push(...this.loadHistoryPage(p));
        }
        return [...this.inbox, ...history];
    }
    getPendingCount() {
        return this.inbox.length;
    }
    setLastCheckAt(iso) {
        this.index.lastCheckAt = iso;
        this.writeFile('index.json', this.index);
    }
    getLastCheckAt() {
        return this.index.lastCheckAt;
    }
}
exports.NotificationRepository = NotificationRepository;
//# sourceMappingURL=NotificationRepository.js.map