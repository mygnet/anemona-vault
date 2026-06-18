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
exports.NotificationService = void 0;
const vscode = __importStar(require("vscode"));
const crypto_1 = require("crypto");
class NotificationService {
    constructor(repository) {
        this.repository = repository;
    }
    generateId() {
        const hex = (0, crypto_1.randomBytes)(16).toString('hex');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            '4' + hex.slice(13, 16),
            '8' + hex.slice(17, 20),
            hex.slice(20, 32),
        ].join('-');
    }
    buildKey(type, relatedItemId) {
        return relatedItemId ? `${type}:${relatedItemId}` : `${type}:${this.generateId()}`;
    }
    createIfNotExists(type, priority, title, message, options) {
        const key = options?.key ?? this.buildKey(type, options?.relatedItemId);
        if (this.repository.keyExists(key)) {
            return null;
        }
        const notification = {
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
        };
        this.repository.addKey(key);
        this.repository.addToInbox(notification);
        return notification;
    }
    createAndShow(type, priority, title, message, options) {
        const notification = this.createIfNotExists(type, priority, title, message, options);
        if (notification) {
            const display = notification.message
                ? `${notification.title}: ${notification.message}`
                : notification.title;
            if (priority === 'high') {
                vscode.window.showWarningMessage(display);
            }
            else {
                vscode.window.showInformationMessage(display);
            }
        }
        return notification;
    }
    markRead(id) {
        this.repository.markRead(id);
    }
    markUnread(id) {
        this.repository.markUnread(id);
    }
    deleteNotification(id) {
        return this.repository.deleteFromHistory(id);
    }
    removeFromInbox(key) {
        this.repository.removeFromInboxByKey(key);
    }
    getInbox() {
        return this.repository.getInbox();
    }
    getHistoryPage(pageNum) {
        return this.repository.getHistoryPage(pageNum);
    }
    getHistoryIndex() {
        return this.repository.getHistoryIndex();
    }
    getAll() {
        return this.repository.getAll();
    }
    getPendingCount() {
        return this.repository.getPendingCount();
    }
    keyExists(key) {
        return this.repository.keyExists(key);
    }
    removeGeneratedKey(key) {
        return this.repository.removeGeneratedKey(key);
    }
    removeGeneratedKeysByPrefix(prefix) {
        return this.repository.removeGeneratedKeysByPrefix(prefix);
    }
    reload() {
        this.repository.reload();
    }
    setLastCheckAt(iso) {
        this.repository.setLastCheckAt(iso);
    }
    getLastCheckAt() {
        return this.repository.getLastCheckAt();
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map