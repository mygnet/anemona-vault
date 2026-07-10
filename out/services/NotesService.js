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
exports.NotesService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const ZipService = __importStar(require("./ZipService"));
const ConfigService_1 = require("./ConfigService");
const CryptoService_1 = require("./CryptoService");
class NotesService {
    constructor() {
        this._crypto = null;
        this.defaultCategoryColor = 'vscode-soft';
        this._cancelSyncAll = false;
        this._isSyncingAll = false;
        this.categoryColors = [
            'vscode-default', 'vscode-muted', 'vscode-soft',
            '#e17076', '#f5a623', '#f7dc6f', '#68c3a0',
            '#54a0ff', '#a29bfe', '#fd79a8', '#00cec9', '#d8dee9',
            '#6c5ce7', '#e84393', '#00b894', '#0984e3', '#f5f7fa',
        ];
        this._browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        };
        this.storagePath = ConfigService_1.ConfigService.getStoragePath();
    }
    get crypto() {
        if (!this._crypto) {
            this._crypto = new CryptoService_1.CryptoService(this.ensureStoragePath());
        }
        return this._crypto;
    }
    setStoragePath(newPath) {
        this.storagePath = newPath;
        this._crypto = null;
    }
    getStoragePath() {
        return this.storagePath;
    }
    getStorageName() {
        if (!this.storagePath)
            return undefined;
        return path.basename(path.normalize(this.storagePath));
    }
    ensureStoragePath() {
        if (!this.storagePath) {
            throw new Error('Storage path not configured');
        }
        const normalized = path.normalize(this.storagePath);
        if (!fs.existsSync(normalized)) {
            fs.mkdirSync(normalized, { recursive: true });
        }
        return normalized;
    }
    isLockedFile(fileName) {
        return fileName.endsWith('.anemona-lock');
    }
    getFileType(fileName) {
        if (fileName.endsWith('.anemona-key') || fileName.endsWith('.anemona-lock'))
            return 'key';
        if (fileName.endsWith('.anemona-command'))
            return 'command';
        if (fileName.endsWith('.anemona-todo'))
            return 'todo';
        if (fileName.endsWith('.anemona-snippet'))
            return 'snippet';
        if (fileName.endsWith('.anemona-reminder'))
            return 'reminder';
        if (fileName.endsWith('.anemona-shot'))
            return 'shot';
        if (fileName.endsWith('.anemona-link'))
            return 'link';
        return 'md';
    }
    getFileIcon(fileName) {
        if (fileName.endsWith('.anemona-lock'))
            return '🔒';
        const type = this.getFileType(fileName);
        switch (type) {
            case 'key': return '🔑';
            case 'command': return '⌘';
            case 'todo': return '☑️';
            case 'snippet': return '📋';
            case 'reminder': return '🔔';
            case 'shot': return '📷';
            case 'link': return '🔗';
            default: return '📄';
        }
    }
    getDisplayName(fileName) {
        return fileName
            .replace(/\.anemona-lock$/, '')
            .replace(/\.anemona-key$/, '')
            .replace(/\.anemona-command$/, '')
            .replace(/\.anemona-todo$/, '')
            .replace(/\.anemona-snippet$/, '')
            .replace(/\.anemona-reminder$/, '')
            .replace(/\.anemona-shot$/, '')
            .replace(/\.anemona-link$/, '')
            .replace(/\.md$/, '');
    }
    getCategories() {
        try {
            const rootPath = this.ensureStoragePath();
            const entries = fs.readdirSync(rootPath, { withFileTypes: true });
            const categories = [];
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('@')) {
                    const categoryPath = path.join(rootPath, entry.name);
                    const config = this.readCategoryConfigSync(categoryPath);
                    categories.push({
                        name: entry.name,
                        path: categoryPath,
                        notes: [],
                        config: config ?? undefined,
                        canDelete: this.canDeleteCategorySync(entry.name),
                    });
                }
            }
            return categories.sort((a, b) => a.name.localeCompare(b.name));
        }
        catch {
            return [];
        }
    }
    readCategoryConfigSync(categoryPath) {
        try {
            const configPath = path.join(categoryPath, '.config.json');
            if (!fs.existsSync(configPath))
                return null;
            const raw = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async readCategoryConfig(categoryName) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
        return this.readCategoryConfigSync(categoryPath);
    }
    async writeCategoryConfig(categoryName, config) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
        if (!fs.existsSync(categoryPath)) {
            fs.mkdirSync(categoryPath, { recursive: true });
        }
        const configPath = path.join(categoryPath, '.config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    async updateCategoryColor(categoryName, color) {
        const current = (await this.readCategoryConfig(categoryName)) ?? {};
        if (!color) {
            delete current.color;
            await this.writeCategoryConfig(categoryName, current);
            return;
        }
        await this.writeCategoryConfig(categoryName, {
            ...current,
            color,
        });
    }
    async updateFolderColor(folderPath, color) {
        const current = this.readCategoryConfigSync(folderPath) ?? {};
        if (!color) {
            delete current.color;
            this.writeCategoryConfigSync(folderPath, current);
            return;
        }
        this.writeCategoryConfigSync(folderPath, { ...current, color });
    }
    writeCategoryConfigSync(folderPath, config) {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const configPath = path.join(folderPath, '.config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    getMergedConfig(categoryName, relativeFolderPath) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
        let merged = {};
        const rootConfig = this.readRootCategoryConfig();
        if (rootConfig) {
            merged = this.mergeConfig(merged, rootConfig);
        }
        const categoryConfig = this.readCategoryConfigSync(categoryPath);
        if (categoryConfig) {
            merged = this.mergeConfig(merged, categoryConfig);
        }
        if (relativeFolderPath) {
            const parts = relativeFolderPath.split('/').filter(Boolean);
            let currentPath = categoryPath;
            for (const part of parts) {
                currentPath = path.join(currentPath, part);
                const folderConfig = this.readCategoryConfigSync(currentPath);
                if (folderConfig) {
                    merged = this.mergeConfig(merged, folderConfig);
                }
            }
        }
        return merged;
    }
    readRootCategoryConfig() {
        try {
            const rootPath = this.ensureStoragePath();
            const configPath = path.join(rootPath, '.config.json');
            if (!fs.existsSync(configPath))
                return null;
            const raw = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(raw);
            const result = {};
            if (typeof parsed.color === 'string')
                result.color = parsed.color;
            if (typeof parsed.icon === 'string')
                result.icon = parsed.icon;
            if (parsed.file && typeof parsed.file === 'object') {
                result.file = parsed.file;
            }
            return Object.keys(result).length > 0 ? result : null;
        }
        catch {
            return null;
        }
    }
    mergeConfig(base, override) {
        const result = { ...base, ...override };
        if (base.file || override.file) {
            result.file = { ...base.file, ...override.file };
        }
        return result;
    }
    getNotesForCategory(categoryName) {
        try {
            const rootPath = this.ensureStoragePath();
            const categoryPath = path.join(rootPath, categoryName);
            if (!fs.existsSync(categoryPath)) {
                return [];
            }
            const entries = fs.readdirSync(categoryPath, { withFileTypes: true });
            const notes = [];
            for (const entry of entries) {
                if (entry.isFile() && !entry.name.startsWith('.')) {
                    const ext = path.extname(entry.name);
                    if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet' || ext === '.anemona-reminder' || ext === '.anemona-link') {
                        const filePath = path.join(categoryPath, entry.name);
                        notes.push({
                            name: entry.name,
                            filePath,
                            content: '',
                            fileType: this.getFileType(entry.name),
                        });
                    }
                }
                else if (entry.isDirectory() && entry.name.endsWith('.anemona-shot')) {
                    const shotFolderPath = path.join(categoryPath, entry.name);
                    if (this.isValidShotFolder(shotFolderPath)) {
                        notes.push({
                            name: entry.name,
                            filePath: shotFolderPath,
                            content: '',
                            fileType: 'shot',
                        });
                    }
                }
            }
            return notes.sort((a, b) => a.name.localeCompare(b.name));
        }
        catch {
            return [];
        }
    }
    getFolderContents(categoryName, relativePath) {
        try {
            const rootPath = this.ensureStoragePath();
            const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
            const targetPath = relativePath ? path.join(categoryPath, relativePath) : categoryPath;
            if (!fs.existsSync(targetPath)) {
                return { folders: [], notes: [] };
            }
            const entries = fs.readdirSync(targetPath, { withFileTypes: true });
            const folders = [];
            const notes = [];
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue;
                const fullPath = path.join(targetPath, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name.endsWith('.anemona-shot') && this.isValidShotFolder(fullPath)) {
                        notes.push({
                            name: entry.name,
                            filePath: fullPath,
                            content: '',
                            fileType: 'shot',
                        });
                    }
                    else {
                        const config = this.readCategoryConfigSync(fullPath);
                        const isEmpty = this._isFolderEmpty(fullPath);
                        folders.push({
                            name: entry.name,
                            path: fullPath,
                            color: config?.color,
                            isEmpty,
                        });
                    }
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet' || ext === '.anemona-reminder' || ext === '.anemona-link') {
                        notes.push({
                            name: entry.name,
                            filePath: fullPath,
                            content: '',
                            fileType: this.getFileType(entry.name),
                        });
                    }
                }
            }
            return {
                folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
                notes: notes.sort((a, b) => a.name.localeCompare(b.name)),
            };
        }
        catch {
            return { folders: [], notes: [] };
        }
    }
    async createNote(categoryName, title, fileType = 'md', parentFolderPath) {
        if (fileType === 'shot') {
            return this.createShot(categoryName, title, parentFolderPath);
        }
        const rootPath = this.ensureStoragePath();
        const categoryPath = parentFolderPath
            ? parentFolderPath
            : path.join(rootPath, this.sanitizePathName(categoryName));
        if (!fs.existsSync(categoryPath)) {
            fs.mkdirSync(categoryPath, { recursive: true });
        }
        const ext = fileType === 'key'
            ? '.anemona-key'
            : fileType === 'command'
                ? '.anemona-command'
                : fileType === 'todo'
                    ? '.anemona-todo'
                    : fileType === 'snippet'
                        ? '.anemona-snippet'
                        : fileType === 'reminder'
                            ? '.anemona-reminder'
                            : fileType === 'link'
                                ? '.anemona-link'
                                : '.md';
        const fileName = this.sanitizePathName(title) + ext;
        const filePath = path.join(categoryPath, fileName);
        if (fs.existsSync(filePath)) {
            throw new Error(`Note "${title}" already exists in ${categoryName}`);
        }
        let content;
        if (fileType === 'key') {
            content = JSON.stringify([], null, 2);
        }
        else if (fileType === 'command') {
            content = JSON.stringify([], null, 2);
        }
        else if (fileType === 'todo') {
            content = JSON.stringify([], null, 2);
        }
        else if (fileType === 'reminder') {
            content = JSON.stringify([], null, 2);
        }
        else if (fileType === 'link') {
            content = JSON.stringify([], null, 2);
        }
        else {
            content = `# ${title}\n\n`;
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        return {
            name: fileName,
            filePath,
            content,
            fileType,
        };
    }
    async readNote(notePath) {
        if (!fs.existsSync(notePath)) {
            throw new Error('Note file not found');
        }
        return fs.readFileSync(notePath, 'utf-8');
    }
    async readKeyEntries(notePath) {
        const raw = await this.readNote(notePath);
        const data = JSON.parse(raw);
        const entries = Array.isArray(data) ? data : data.entries || [];
        const locked = data.locked === true;
        return { entries, locked };
    }
    async readDecryptedKeyEntries(notePath) {
        const { entries } = await this.readKeyEntries(notePath);
        return this.crypto.decryptEntries(entries);
    }
    async lockNoteFile(notePath, password) {
        if (!notePath.endsWith('.anemona-key'))
            throw new Error('Not a key file');
        const content = fs.readFileSync(notePath, 'utf-8');
        const encrypted = this.crypto.encryptFileContent(content, password);
        const lockPath = notePath.replace(/\.anemona-key$/, '.anemona-lock');
        fs.writeFileSync(lockPath, encrypted, 'utf-8');
        fs.unlinkSync(notePath);
        return lockPath;
    }
    async unlockNoteFile(notePath, password) {
        if (!notePath.endsWith('.anemona-lock'))
            throw new Error('Not a lock file');
        const encrypted = fs.readFileSync(notePath, 'utf-8');
        const decrypted = this.crypto.decryptFileContent(encrypted, password);
        if (!decrypted)
            return null;
        const keyPath = notePath.replace(/\.anemona-lock$/, '.anemona-key');
        fs.writeFileSync(keyPath, decrypted, 'utf-8');
        fs.unlinkSync(notePath);
        return keyPath;
    }
    async saveKeyEntries(notePath, entries, locked) {
        let encrypted;
        try {
            encrypted = this.crypto.encryptEntries(entries);
        }
        catch (err) {
            if (err instanceof Error &&
                err.message === 'Vault is locked. Enter your password to unlock.' &&
                this.crypto.isUsingPasswordMode() &&
                this.isEmptyKeyFile(notePath)) {
                this.crypto.resetToPlainKey();
                encrypted = this.crypto.encryptEntries(entries);
            }
            else {
                throw err;
            }
        }
        const data = { entries: encrypted, locked };
        fs.writeFileSync(notePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    async readCommandEntries(notePath) {
        const raw = await this.readNote(notePath);
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data.map((entry) => ({
            title: String(entry?.title || '').trim(),
            command: String(entry?.command || '').trim(),
            documentation: String(entry?.documentation || '').trim() || undefined,
        }));
    }
    async saveCommandEntries(notePath, entries) {
        const normalized = entries.map((entry) => ({
            title: String(entry.title || '').trim(),
            command: String(entry.command || '').trim(),
            documentation: String(entry.documentation || '').trim() || undefined,
        }));
        fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    async readLinkEntries(notePath) {
        const raw = await this.readNote(notePath);
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data.map((entry) => ({
            title: String(entry?.title || '').trim(),
            url: String(entry?.url || '').trim(),
            description: String(entry?.description || '').trim() || undefined,
            status: ['unknown', 'ok', 'error'].includes(entry?.status) ? entry.status : undefined,
            favicon: String(entry?.favicon || '').trim() || undefined,
            lastCheckedAt: String(entry?.lastCheckedAt || '').trim() || undefined,
        }));
    }
    async saveLinkEntries(notePath, entries) {
        const normalized = entries.map((entry) => ({
            title: String(entry.title || '').trim(),
            url: String(entry.url || '').trim(),
            description: String(entry.description || '').trim() || undefined,
            status: entry.status !== 'unknown' ? entry.status : undefined,
            favicon: String(entry.favicon || '').trim() || undefined,
            lastCheckedAt: String(entry.lastCheckedAt || '').trim() || undefined,
        }));
        fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    _fetchUrl(targetUrl, timeout = 8000) {
        return new Promise((resolve, reject) => {
            try {
                const parsed = new URL(targetUrl);
                const mod = parsed.protocol === 'https:' ? https : http;
                const req = mod.get(targetUrl, { timeout, headers: this._browserHeaders }, (res) => {
                    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        res.resume();
                        return resolve(this._fetchUrl(new URL(res.headers.location, targetUrl).href, timeout));
                    }
                    const code = res.statusCode || 0;
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        const body = Buffer.concat(chunks).toString('utf-8');
                        if (code >= 500)
                            return reject(new Error(`HTTP ${code}`));
                        resolve({ body, contentType: res.headers['content-type'] || '', statusCode: code });
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
                const timer = setTimeout(() => {
                    req.destroy(new Error('Timeout'));
                    reject(new Error('Timeout'));
                }, timeout);
                req.on('response', () => clearTimeout(timer));
                req.on('error', () => clearTimeout(timer));
            }
            catch (err) {
                reject(err);
            }
        });
    }
    _fetchBinary(targetUrl, timeout = 8000) {
        return new Promise((resolve, reject) => {
            try {
                const parsed = new URL(targetUrl);
                const mod = parsed.protocol === 'https:' ? https : http;
                const req = mod.get(targetUrl, { timeout, headers: this._browserHeaders }, (res) => {
                    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        res.resume();
                        return resolve(this._fetchBinary(new URL(res.headers.location, targetUrl).href, timeout));
                    }
                    if (!res.statusCode || res.statusCode >= 400) {
                        res.resume();
                        return reject(new Error(`HTTP ${res.statusCode}`));
                    }
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
                });
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
                const timer = setTimeout(() => {
                    req.destroy(new Error('Timeout'));
                    reject(new Error('Timeout'));
                }, timeout);
                req.on('response', () => clearTimeout(timer));
                req.on('error', () => clearTimeout(timer));
            }
            catch (err) {
                reject(err);
            }
        });
    }
    _extractHtmlTitle(html) {
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (!match)
            return null;
        return match[1].replace(/\s+/g, ' ').trim() || null;
    }
    _extractFaviconUrl(html, baseUrl) {
        const linkTagPattern = /<link[\s>][\s\S]*?\/?>/gi;
        const attrRe = /(\w+(?:-\w+)*)\s*=\s*["']([^"']*)["']/gi;
        let match;
        while ((match = linkTagPattern.exec(html)) !== null) {
            const tag = match[0];
            let rel = null;
            let href = null;
            attrRe.lastIndex = 0;
            let attrMatch;
            while ((attrMatch = attrRe.exec(tag)) !== null) {
                const name = attrMatch[1].toLowerCase();
                const value = attrMatch[2];
                if (name === 'rel')
                    rel = value.toLowerCase();
                if (name === 'href')
                    href = value;
            }
            if (rel && href && /^(?:apple-touch-)?icon$|^shortcut icon$/.test(rel)) {
                try {
                    return new URL(href, baseUrl).href;
                }
                catch {
                    return href;
                }
            }
        }
        // Last resort: try /favicon.ico at the domain root
        try {
            const parsed = new URL(baseUrl);
            const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
            return `${origin}/favicon.ico`;
        }
        catch {
            return null;
        }
    }
    _imageExtFromContentType(contentType) {
        const map = {
            'image/png': 'png',
            'image/x-icon': 'ico',
            'image/vnd.microsoft.icon': 'ico',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/webp': 'webp',
        };
        const ct = contentType.split(';')[0].trim().toLowerCase();
        return map[ct] || 'png';
    }
    async syncLinkEntry(entry) {
        const now = new Date().toISOString();
        try {
            const { body, statusCode } = await this._fetchUrl(entry.url);
            if (statusCode === 404 || statusCode === 410) {
                return {
                    entry: { ...entry, status: 'error', lastCheckedAt: now },
                    message: this._describeFetchError(entry.url, statusCode, body),
                };
            }
            if (statusCode >= 400) {
                return {
                    entry: { ...entry, lastCheckedAt: now },
                    message: this._describeFetchError(entry.url, statusCode, body),
                };
            }
            const updated = {
                ...entry,
                status: 'ok',
                lastCheckedAt: now,
            };
            const pageTitle = this._extractHtmlTitle(body);
            if (pageTitle && !entry.title.startsWith('http')) {
                updated.title = pageTitle;
            }
            else if (!entry.title) {
                updated.title = pageTitle || entry.title;
            }
            const favicon = await this._fetchFaviconOnly(body, entry.url);
            if (favicon)
                updated.favicon = favicon;
            // fallback: if no favicon or title, try the root domain
            if (!updated.favicon || !updated.title) {
                const origin = this._getOrigin(entry.url);
                if (origin) {
                    try {
                        const { body: originBody, statusCode: originCode } = await this._fetchUrl(origin);
                        if (originCode < 400) {
                            if (!updated.title) {
                                const originTitle = this._extractHtmlTitle(originBody);
                                if (originTitle && !entry.title.startsWith('http')) {
                                    updated.title = originTitle;
                                }
                                else if (!entry.title) {
                                    updated.title = originTitle || entry.title;
                                }
                            }
                            if (!updated.favicon) {
                                const originFavicon = await this._fetchFaviconOnly(originBody, origin);
                                if (originFavicon)
                                    updated.favicon = originFavicon;
                            }
                        }
                    }
                    catch {
                        // fallback failed silently
                    }
                }
            }
            return { entry: updated };
        }
        catch (err) {
            return {
                entry: { ...entry, lastCheckedAt: now },
                message: this._describeFetchError(entry.url, undefined, undefined, err),
            };
        }
    }
    cancelSyncAll() {
        this._cancelSyncAll = true;
    }
    isSyncAllCancelled() {
        return this._cancelSyncAll;
    }
    resetSyncAllCancel() {
        this._cancelSyncAll = false;
    }
    async syncLinkEntries(notePath, entries) {
        if (this._isSyncingAll) {
            return { entries, messages: ['Ya hay una sincronización en curso'], cancelled: false };
        }
        this._isSyncingAll = true;
        this._cancelSyncAll = false;
        const results = [];
        const messages = [];
        try {
            for (const entry of entries) {
                if (this._cancelSyncAll)
                    break;
                const { entry: synced, message } = await this.syncLinkEntry(entry);
                results.push(synced);
                if (message)
                    messages.push(message);
            }
            await this.saveLinkEntries(notePath, results);
        }
        finally {
            this._isSyncingAll = false;
        }
        return { entries: results, messages, cancelled: this._cancelSyncAll };
    }
    _describeFetchError(url, statusCode, body, caught) {
        if (caught) {
            const msg = String(caught);
            if (msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN'))
                return `No se pudo resolver el dominio de "${url}". Verifica que la URL sea correcta.`;
            if (msg.includes('ECONNREFUSED'))
                return `Conexión rechazada por "${url}". El servidor puede estar caído.`;
            if (msg.includes('ECONNRESET') || msg.includes('EPIPE'))
                return `La conexión con "${url}" fue interrumpida.`;
            if (msg.includes('Timeout'))
                return `El sitio "${url}" no respondió a tiempo.`;
            if (msg.includes('certificate') || msg.includes('CERT') || msg.includes('SSL'))
                return `Error de certificado SSL en "${url}".`;
            return `Error de conexión al intentar acceder a "${url}".`;
        }
        if (statusCode === 403) {
            if (body && (body.includes('cf-mitigated') || body.includes('challenges.cloudflare.com'))) {
                return `"${url}" está protegido por Cloudflare y requiere JavaScript. No se puede obtener el contenido automáticamente.`;
            }
            return `Acceso denegado (HTTP 403) a "${url}".`;
        }
        if (statusCode === 404)
            return `Página no encontrada (HTTP 404) para "${url}".`;
        if (statusCode === 410)
            return `La página "${url}" ya no existe (HTTP 410).`;
        if (statusCode === 429)
            return `Demasiadas solicitudes (HTTP 429) a "${url}". Intenta más tarde.`;
        if (statusCode && statusCode >= 400)
            return `El sitio respondió con código HTTP ${statusCode} para "${url}".`;
        return '';
    }
    async previewLink(url) {
        const result = { title: '' };
        try {
            const { body, statusCode } = await this._fetchUrl(url);
            if (statusCode >= 400) {
                result.message = this._describeFetchError(url, statusCode, body);
                return result;
            }
            const pageTitle = this._extractHtmlTitle(body);
            if (pageTitle)
                result.title = pageTitle;
            const metaDesc = this._extractMetaDescription(body);
            if (metaDesc)
                result.description = metaDesc;
            const favicon = await this._fetchFaviconOnly(body, url);
            if (favicon)
                result.favicon = favicon;
            // fallback: if no favicon or title, try the root domain
            if (!result.favicon || !result.title) {
                const origin = this._getOrigin(url);
                if (origin) {
                    try {
                        const { body: originBody, statusCode: originCode } = await this._fetchUrl(origin);
                        if (originCode < 400) {
                            if (!result.title) {
                                const originTitle = this._extractHtmlTitle(originBody);
                                if (originTitle)
                                    result.title = originTitle;
                            }
                            if (!result.favicon) {
                                const originFavicon = await this._fetchFaviconOnly(originBody, origin);
                                if (originFavicon)
                                    result.favicon = originFavicon;
                            }
                        }
                    }
                    catch {
                        // fallback failed silently
                    }
                }
            }
        }
        catch (err) {
            result.message = this._describeFetchError(url, undefined, undefined, err);
        }
        return result;
    }
    _getOrigin(url) {
        try {
            const parsed = new URL(url);
            const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
            if (origin === url || !parsed.pathname || parsed.pathname === '/' || parsed.pathname === '')
                return null;
            return origin;
        }
        catch {
            return null;
        }
    }
    async _fetchFaviconOnly(html, pageUrl) {
        const faviconUrl = this._extractFaviconUrl(html, pageUrl);
        if (!faviconUrl)
            return undefined;
        try {
            const { data, contentType } = await this._fetchBinary(faviconUrl);
            return `data:${contentType.split(';')[0].trim() || 'image/png'};base64,${data.toString('base64')}`;
        }
        catch {
            return undefined;
        }
    }
    _extractMetaDescription(html) {
        const patterns = [
            /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
            /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
            /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
        ];
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1].trim()) {
                return match[1].trim();
            }
        }
        return null;
    }
    async readTodoEntries(notePath) {
        const raw = await this.readNote(notePath);
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data.map((entry) => ({
            id: String(entry?.id || '') || undefined,
            title: String(entry?.title || '').trim(),
            text: String(entry?.text || '').trim() || undefined,
            progress: Math.max(0, Math.min(100, Number(entry?.progress) || 0)),
            status: entry?.status === 'done' || entry?.status === 'cancelled' ? entry.status : 'open',
            priority: entry?.priority === 'low' || entry?.priority === 'high' ? entry.priority : 'medium',
            dueAt: this.normalizeTodoDueAt(entry?.dueAt),
        }));
    }
    generateUUID() {
        const hex = crypto.randomBytes(16).toString('hex');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            '4' + hex.slice(13, 16),
            '8' + hex.slice(17, 20),
            hex.slice(20, 32),
        ].join('-');
    }
    async saveTodoEntries(notePath, entries) {
        const normalized = entries.map((entry) => ({
            id: entry.id || this.generateUUID(),
            title: String(entry.title || '').trim(),
            text: String(entry.text || '').trim() || undefined,
            progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
            status: entry.status === 'done' || entry.status === 'cancelled' ? entry.status : 'open',
            priority: entry.priority === 'low' || entry.priority === 'high' ? entry.priority : 'medium',
            dueAt: this.normalizeTodoDueAt(entry.dueAt),
        }));
        fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    async readSnippetEntries(notePath) {
        if (!fs.existsSync(notePath))
            return [];
        try {
            const raw = fs.readFileSync(notePath, 'utf-8').trim();
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.filter((e) => typeof e === 'object' && e !== null &&
                typeof e.title === 'string' &&
                typeof e.language === 'string' &&
                typeof e.code === 'string');
        }
        catch {
            return [];
        }
    }
    async saveSnippetEntries(notePath, entries) {
        const normalized = entries.map((entry) => ({
            title: String(entry.title || '').trim(),
            language: String(entry.language || 'text').trim(),
            code: entry.code || '',
        }));
        fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    async readReminderEntries(notePath) {
        if (!fs.existsSync(notePath))
            return [];
        try {
            const raw = fs.readFileSync(notePath, 'utf-8').trim();
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed))
                return [];
            return parsed.map((r) => ({
                id: String(r.id || ''),
                title: String(r.title || '').trim() || undefined,
                text: String(r.text || ''),
                dueAt: String(r.dueAt || ''),
                status: r.status === 'completed' ? 'completed' : 'pending',
                action: {
                    type: r.action?.type === 'file' || r.action?.type === 'url' || r.action?.type === 'command' || r.action?.type === 'task' ? r.action.type : 'none',
                    target: String(r.action?.target || ''),
                },
                interval: r.interval && ['minute', 'hour', 'day', 'week', 'month', 'year'].includes(r.interval.unit) && Number.isFinite(r.interval.value) && r.interval.value > 0
                    ? { unit: r.interval.unit, value: r.interval.value }
                    : undefined,
                createdAt: String(r.createdAt || ''),
                updatedAt: String(r.updatedAt || ''),
            }));
        }
        catch {
            return [];
        }
    }
    async saveReminderEntries(notePath, entries) {
        const now = new Date().toISOString();
        const normalized = entries.map((entry) => ({
            id: entry.id,
            title: String(entry.title || '').trim() || undefined,
            text: String(entry.text || '').trim(),
            dueAt: this.normalizeTodoDueAt(entry.dueAt) || entry.dueAt,
            status: entry.status === 'completed' ? 'completed' : 'pending',
            action: {
                type: entry.action?.type || 'none',
                target: String(entry.action?.target || ''),
            },
            interval: entry.interval && ['minute', 'hour', 'day', 'week', 'month', 'year'].includes(entry.interval.unit) && Number.isFinite(entry.interval.value) && entry.interval.value > 0
                ? { unit: entry.interval.unit, value: entry.interval.value }
                : undefined,
            createdAt: entry.createdAt || now,
            updatedAt: now,
        }));
        fs.writeFileSync(notePath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    isValidShotFolder(folderPath) {
        try {
            return fs.existsSync(path.join(folderPath, 'anemona-shot.json'));
        }
        catch {
            return false;
        }
    }
    ensureShotStructure(folderPath) {
        const imagesDir = path.join(folderPath, 'images');
        const metaPath = path.join(folderPath, 'anemona-shot.json');
        fs.mkdirSync(imagesDir, { recursive: true });
        if (!fs.existsSync(metaPath)) {
            fs.writeFileSync(metaPath, JSON.stringify([], null, 2), 'utf-8');
        }
        return metaPath;
    }
    detectImageType(filePath) {
        if (!fs.existsSync(filePath))
            return null;
        const buffer = fs.readFileSync(filePath);
        const header = buffer.subarray(0, 16);
        const textHeader = header.toString('utf-8').trimStart().toLowerCase();
        if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
            return { ext: '.png', mimeType: 'image/png' };
        }
        if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
            return { ext: '.jpg', mimeType: 'image/jpeg' };
        }
        if (header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP') {
            return { ext: '.webp', mimeType: 'image/webp' };
        }
        if (header.subarray(0, 3).toString('ascii') === 'GIF') {
            return { ext: '.gif', mimeType: 'image/gif' };
        }
        if (textHeader.startsWith('<svg') || textHeader.startsWith('<?xml')) {
            return { ext: '.svg', mimeType: 'image/svg+xml' };
        }
        return null;
    }
    repairShotEntries(folderPath, entries) {
        let changed = false;
        const repaired = entries.map((entry) => {
            const filePath = path.join(folderPath, 'images', entry.filename);
            const shouldRepairName = entry.filename.endsWith('.undefined') || path.extname(entry.filename) === '';
            const shouldRepairMime = !entry.mimeType || entry.mimeType === 'image/';
            if (!shouldRepairName && !shouldRepairMime)
                return entry;
            const detected = this.detectImageType(filePath);
            if (!detected)
                return entry;
            let filename = entry.filename;
            if (shouldRepairName) {
                const baseName = entry.filename.endsWith('.undefined')
                    ? entry.filename.slice(0, -'.undefined'.length)
                    : entry.filename;
                filename = `${baseName}${detected.ext}`;
                const nextPath = path.join(folderPath, 'images', filename);
                if (fs.existsSync(filePath) && !fs.existsSync(nextPath)) {
                    fs.renameSync(filePath, nextPath);
                }
            }
            changed = true;
            return {
                ...entry,
                filename,
                path: `images/${filename}`,
                mimeType: detected.mimeType,
            };
        });
        return { entries: repaired, changed };
    }
    async createShot(categoryName, title, parentFolderPath) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = parentFolderPath
            ? parentFolderPath
            : path.join(rootPath, this.sanitizePathName(categoryName));
        const folderName = this.sanitizePathName(title) + '.anemona-shot';
        const folderPath = path.join(categoryPath, folderName);
        if (fs.existsSync(folderPath)) {
            throw new Error(`Shot "${title}" already exists`);
        }
        this.ensureShotStructure(folderPath);
        return {
            name: folderName,
            filePath: folderPath,
            content: '',
            fileType: 'shot',
        };
    }
    async readShotEntries(folderPath) {
        try {
            const metaPath = this.ensureShotStructure(folderPath);
            const raw = fs.readFileSync(metaPath, 'utf-8').trim();
            if (!raw)
                return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                throw new Error('Invalid Anémona Shot metadata. Expected a JSON array.');
            }
            const entries = parsed.map((e) => {
                const filename = String(e.filename || '');
                const imagePath = filename ? path.join(folderPath, 'images', filename) : '';
                const fileSize = imagePath && fs.existsSync(imagePath) ? fs.statSync(imagePath).size : undefined;
                return {
                    id: String(e.id || ''),
                    filename,
                    path: String(e.path || ''),
                    mimeType: String(e.mimeType || ''),
                    fileSize,
                    createdAt: String(e.createdAt || ''),
                    updatedAt: String(e.updatedAt || ''),
                    title: String(e.title || '').trim() || undefined,
                    description: String(e.description || '').trim() || undefined,
                    url: String(e.url || '').trim() || undefined,
                    tags: Array.isArray(e.tags) ? e.tags.map(String) : undefined,
                };
            });
            const repaired = this.repairShotEntries(folderPath, entries);
            if (repaired.changed) {
                await this.saveShotEntries(folderPath, repaired.entries);
            }
            return repaired.entries;
        }
        catch (err) {
            if (err instanceof SyntaxError) {
                throw new Error('Invalid Anémona Shot metadata. Check anemona-shot.json.');
            }
            throw err;
        }
    }
    async saveShotEntries(folderPath, entries) {
        const now = new Date().toISOString();
        const normalized = entries.map((entry) => ({
            id: entry.id,
            filename: entry.filename,
            path: entry.path,
            mimeType: entry.mimeType,
            createdAt: entry.createdAt || now,
            updatedAt: now,
            title: String(entry.title || '').trim() || undefined,
            description: String(entry.description || '').trim() || undefined,
            url: String(entry.url || '').trim() || undefined,
            tags: Array.isArray(entry.tags) && entry.tags.length > 0
                ? entry.tags.map((t) => String(t).trim()).filter(Boolean)
                : undefined,
        }));
        const metaPath = this.ensureShotStructure(folderPath);
        fs.writeFileSync(metaPath, JSON.stringify(normalized, null, 2), 'utf-8');
    }
    async deleteShot(folderPath) {
        if (!fs.existsSync(folderPath)) {
            throw new Error('Shot folder not found');
        }
        if (!folderPath.endsWith('.anemona-shot')) {
            throw new Error('Not a shot folder');
        }
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
    async exportShot(folderPath, outputPath) {
        if (!folderPath.endsWith('.anemona-shot') || !this.isValidShotFolder(folderPath)) {
            throw new Error('Not a valid Anémona Shot folder');
        }
        this.ensureShotStructure(folderPath);
        await ZipService.createArchive(folderPath, outputPath);
    }
    async importShot(folderPath, zipPath) {
        if (!folderPath.endsWith('.anemona-shot')) {
            throw new Error('Not an Anémona Shot folder');
        }
        const tmpDir = path.join(path.dirname(folderPath), `.shot-import-tmp-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        try {
            await ZipService.extractArchive(zipPath, tmpDir);
            const sourceDir = this.findShotImportRoot(tmpDir);
            if (!sourceDir) {
                throw new Error('ZIP does not contain a valid Anémona Shot structure');
            }
            this.clearDirectory(folderPath);
            this.copyDirectory(sourceDir, folderPath);
            this.ensureShotStructure(folderPath);
        }
        finally {
            this._rmRecursive(tmpDir);
        }
    }
    findShotImportRoot(dir) {
        if (this.isValidShotFolder(dir))
            return dir;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const found = this.findShotImportRoot(path.join(dir, entry.name));
            if (found)
                return found;
        }
        return null;
    }
    clearDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            return;
        }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this._rmRecursive(fullPath);
            }
            else {
                fs.unlinkSync(fullPath);
            }
        }
    }
    copyDirectory(srcDir, destDir) {
        fs.mkdirSync(destDir, { recursive: true });
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
            const src = path.join(srcDir, entry.name);
            const dest = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                this.copyDirectory(src, dest);
            }
            else {
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(src, dest);
            }
        }
    }
    async updateCategoryFileProgress(folderPath, fileName, progress) {
        const current = this.readCategoryConfigSync(folderPath) ?? {};
        this.writeCategoryConfigSync(folderPath, {
            ...current,
            file: {
                ...current.file,
                [fileName]: { progress },
            },
        });
    }
    async searchAll(query) {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery)
            return [];
        const results = [];
        for (const category of this.getCategories()) {
            const categoryPath = path.join(this.ensureStoragePath(), category.name);
            const allNotes = this.getNotesRecursive(categoryPath);
            for (const note of allNotes) {
                const result = await this.searchNoteFile(category.name, note, normalizedQuery);
                if (result) {
                    results.push(result);
                }
            }
        }
        return results.sort((a, b) => {
            const categoryCmp = a.category.localeCompare(b.category);
            if (categoryCmp !== 0)
                return categoryCmp;
            return a.displayName.localeCompare(b.displayName);
        });
    }
    async searchNoteFile(categoryName, note, normalizedQuery) {
        if (note.filePath.endsWith('.anemona-lock')) {
            return null;
        }
        if (note.fileType === 'command') {
            const entries = await this.readCommandEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.command, entry.documentation].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Command', match.command || match.documentation || match.title);
        }
        if (note.fileType === 'link') {
            const entries = await this.readLinkEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.url, entry.description].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Link', match.url || match.description || match.title);
        }
        if (note.fileType === 'todo') {
            const entries = await this.readTodoEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.text, entry.status, entry.priority].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Task', `${match.title}${match.text ? ' — ' + match.text : ''}  (${match.priority}, ${match.status})`);
        }
        if (note.fileType === 'key') {
            try {
                const entries = await this.readDecryptedKeyEntries(note.filePath);
                const match = entries.find((entry) => [
                    entry.title,
                    entry.password,
                    entry.note,
                    entry.url,
                    entry.email,
                    entry.username,
                    entry.host,
                    entry.port,
                    entry.token,
                ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
                if (!match)
                    return null;
                const snippet = [match.title, match.url, match.email, match.username, match.host, match.note]
                    .find((value) => value && String(value).trim()) || match.password;
                return this.toSearchResult(categoryName, note, match.title || 'Key entry', snippet);
            }
            catch {
                return null;
            }
        }
        if (note.fileType === 'snippet') {
            const entries = await this.readSnippetEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.language, entry.code].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Snippet', match.code);
        }
        if (note.fileType === 'reminder') {
            const entries = await this.readReminderEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.text, entry.status].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || match.text || 'Reminder', `${match.title ? match.title + ' — ' : ''}${match.text}`);
        }
        if (note.fileType === 'shot') {
            const entries = await this.readShotEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.description, entry.filename, entry.url, ...(entry.tags || [])].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || match.filename || 'Image', match.description || match.filename);
        }
        const content = await this.readNote(note.filePath);
        const matchLine = content
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.toLowerCase().includes(normalizedQuery));
        if (!matchLine)
            return null;
        return this.toSearchResult(categoryName, note, 'Document', matchLine);
    }
    toSearchResult(categoryName, note, matchLabel, snippet) {
        return {
            category: categoryName,
            noteName: note.name,
            filePath: note.filePath,
            fileType: note.fileType,
            displayName: this.getDisplayName(note.name),
            matchLabel,
            snippet: this.compactSnippet(snippet || ''),
        };
    }
    compactSnippet(value) {
        const compact = value.replace(/\s+/g, ' ').trim();
        if (compact.length <= 180)
            return compact;
        return `${compact.slice(0, 177)}...`;
    }
    normalizeTodoDueAt(value) {
        if (typeof value !== 'string')
            return undefined;
        const trimmed = value.trim();
        if (!trimmed)
            return undefined;
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed) ? trimmed : undefined;
    }
    async saveNote(notePath, content) {
        if (!fs.existsSync(notePath)) {
            throw new Error('Note file not found');
        }
        fs.writeFileSync(notePath, content, 'utf-8');
    }
    async deleteNote(notePath) {
        if (!fs.existsSync(notePath)) {
            throw new Error('Note file not found');
        }
        if (notePath.endsWith('.anemona-shot')) {
            return this.deleteShot(notePath);
        }
        fs.unlinkSync(notePath);
    }
    async renameNote(notePath, newTitle) {
        if (!fs.existsSync(notePath)) {
            throw new Error('Note file not found');
        }
        const trimmed = newTitle.trim();
        if (!trimmed) {
            throw new Error('Name is required');
        }
        const dirPath = path.dirname(notePath);
        const ext = this.detectFullExtension(path.basename(notePath));
        const newPath = path.join(dirPath, this.sanitizePathName(trimmed) + ext);
        if (newPath === notePath) {
            return notePath;
        }
        const targetFileName = path.basename(newPath).toLowerCase();
        const collision = fs.readdirSync(dirPath).some((fileName) => {
            const filePath = path.join(dirPath, fileName);
            return fileName.toLowerCase() === targetFileName && filePath !== notePath;
        });
        if (collision) {
            throw new Error(`Note "${trimmed}" already exists in this folder`);
        }
        fs.renameSync(notePath, newPath);
        return newPath;
    }
    async moveNote(notePath, targetCategory) {
        if (!fs.existsSync(notePath)) {
            throw new Error('Note file not found');
        }
        const rootPath = this.ensureStoragePath();
        const targetDir = path.join(rootPath, this.sanitizePathName(targetCategory));
        if (!fs.existsSync(targetDir)) {
            throw new Error(`Category "${targetCategory}" does not exist`);
        }
        const fileName = path.basename(notePath);
        const destPath = path.join(targetDir, fileName);
        if (fs.existsSync(destPath)) {
            throw new Error(`A file named "${fileName}" already exists in "${targetCategory}"`);
        }
        fs.renameSync(notePath, destPath);
        const sourceCategory = path.basename(path.dirname(notePath));
        if (sourceCategory !== this.sanitizePathName(targetCategory)) {
            const oldConfig = (await this.readCategoryConfig(sourceCategory)) ?? {};
            if (oldConfig.file?.[fileName]) {
                const { [fileName]: movedEntry, ...rest } = oldConfig.file;
                await this.writeCategoryConfig(sourceCategory, { ...oldConfig, file: rest });
                const targetConfig = (await this.readCategoryConfig(targetCategory)) ?? {};
                await this.writeCategoryConfig(targetCategory, {
                    ...targetConfig,
                    file: {
                        ...targetConfig.file,
                        [fileName]: movedEntry,
                    },
                });
            }
        }
    }
    async exportNote(notePath, format) {
        const fileName = path.basename(notePath);
        const fileType = this.getFileType(fileName);
        const displayName = this.getDisplayName(fileName);
        if (fileType === 'key') {
            if (format === 'en-claro') {
                const { entries, locked } = await this.readKeyEntries(notePath);
                const data = locked ? entries : await this.readDecryptedKeyEntries(notePath);
                return { content: JSON.stringify(data, null, 2), language: 'json' };
            }
            const content = await this.readNote(notePath);
            return { content, language: 'json' };
        }
        if (fileType === 'command') {
            const entries = await this.readCommandEntries(notePath);
            if (format === 'texto') {
                const lines = entries.map((e, i) => `${i + 1}. ${e.title}\n   $ ${e.command}${e.documentation ? `\n   ${e.documentation}` : ''}`);
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            if (format === 'markdown') {
                const md = entries.map(e => `### ${e.title}\n\n\`\`\`bash\n${e.command}\n\`\`\`${e.documentation ? `\n\n${e.documentation}` : ''}`).join('\n\n');
                return { content: `# ${displayName}\n\n${md}`, language: 'markdown' };
            }
            const content = await this.readNote(notePath);
            return { content, language: 'json' };
        }
        if (fileType === 'link') {
            const entries = await this.readLinkEntries(notePath);
            if (format === 'texto') {
                const lines = entries.map((e, i) => `${i + 1}. ${e.title}\n   ${e.url}${e.description ? `\n   ${e.description}` : ''}`);
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            if (format === 'markdown') {
                const md = entries.map(e => `### ${e.title}\n\n[${e.url}](${e.url})${e.description ? `\n\n${e.description}` : ''}`).join('\n\n');
                return { content: `# ${displayName}\n\n${md}`, language: 'markdown' };
            }
            const content = await this.readNote(notePath);
            return { content, language: 'json' };
        }
        if (fileType === 'todo') {
            const entries = await this.readTodoEntries(notePath);
            if (format === 'default') {
                return { content: JSON.stringify(entries, null, 2), language: 'json' };
            }
            if (format === 'texto') {
                const lines = entries.map(e => {
                    const status = e.status === 'done' ? '[x]' : e.status === 'cancelled' ? '[-]' : '[ ]';
                    return `${status} ${e.title} (${e.progress}%)`;
                });
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            const lines = entries.map(e => {
                if (e.status === 'cancelled')
                    return `- ~~[ ] ${e.title}~~`;
                if (e.status === 'done')
                    return `- [x] ${e.title}`;
                const p = Math.max(0, Math.min(100, Number(e.progress) || 0));
                return `- [ ] ${e.title}${p > 0 ? ` (${p}%)` : ''}`;
            });
            return { content: `# ${displayName}\n\n${lines.join('\n')}`, language: 'markdown' };
        }
        if (fileType === 'snippet') {
            const entries = await this.readSnippetEntries(notePath);
            if (format === 'texto') {
                const lines = entries.map(e => {
                    return `---\n# ${e.title}\nLanguage: ${e.language}\n\n${e.code}`;
                });
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            if (format === 'markdown') {
                const md = entries.map(e => `### ${e.title}\n\n\`\`\`${e.language}\n${e.code}\n\`\`\``).join('\n\n');
                return { content: `# ${displayName}\n\n${md}`, language: 'markdown' };
            }
            return { content: JSON.stringify(entries, null, 2), language: 'json' };
        }
        if (fileType === 'reminder') {
            const entries = await this.readReminderEntries(notePath);
            if (format === 'texto') {
                const lines = entries.map(e => {
                    const status = e.status === 'completed' ? '[x]' : '[ ]';
                    const label = e.title || e.text;
                    return `${status} ${label}${e.dueAt ? ` (due: ${e.dueAt})` : ''}`;
                });
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            if (format === 'markdown') {
                const md = entries.map(e => {
                    const label = e.title || e.text;
                    return `- ${e.status === 'completed' ? '[x]' : '[ ]'} **${label}**${e.dueAt ? ` — ${e.dueAt}` : ''}`;
                }).join('\n');
                return { content: `# ${displayName}\n\n${md}`, language: 'markdown' };
            }
            return { content: JSON.stringify(entries, null, 2), language: 'json' };
        }
        if (fileType === 'shot') {
            const entries = await this.readShotEntries(notePath);
            const lines = entries.map(e => {
                const tags = e.tags?.length ? ` [${e.tags.join(', ')}]` : '';
                return `- ${e.filename}: ${e.title || ''}${e.description ? ' — ' + e.description : ''}${tags}${e.url ? ' (url: ' + e.url + ')' : ''}`;
            });
            return { content: `# ${displayName}\n\n${lines.join('\n')}`, language: 'markdown' };
        }
        const content = await this.readNote(notePath);
        return { content, language: 'markdown' };
    }
    renderTodoAsMarkdown(entries, title) {
        const active = entries.filter(e => e.status !== 'cancelled');
        const totalProgress = active.length === 0
            ? 0
            : Math.round(active.reduce((s, e) => s + Math.max(0, Math.min(100, Number(e.progress) || 0)), 0) / active.length);
        const barLen = 16;
        const filled = Math.round(totalProgress / 100 * barLen);
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        const lines = [];
        lines.push(`# ${title}`);
        lines.push('');
        lines.push(`> Progress: ${bar} ${totalProgress}%`);
        lines.push('');
        const done = entries.filter(e => e.status === 'done');
        const inProgress = entries.filter(e => e.status === 'open' && e.progress > 0);
        const open = entries.filter(e => e.status === 'open' && e.progress === 0);
        const cancelled = entries.filter(e => e.status === 'cancelled');
        if (done.length > 0) {
            lines.push('## ✅ Done');
            for (const e of done)
                lines.push(`- [x] ${e.title}`);
            lines.push('');
        }
        if (inProgress.length > 0) {
            lines.push('## 🔄 In Progress');
            for (const e of inProgress) {
                const p = Math.max(0, Math.min(100, Number(e.progress) || 0));
                const pf = Math.round(p / 100 * barLen);
                const pb = '█'.repeat(pf) + '░'.repeat(barLen - pf);
                lines.push(`- ${pb} **${e.title}** (${p}%)`);
            }
            lines.push('');
        }
        if (open.length > 0) {
            lines.push('## 📋 Open');
            for (const e of open)
                lines.push(`- [ ] ${e.title}`);
            lines.push('');
        }
        if (cancelled.length > 0) {
            lines.push('## ❌ Cancelled');
            for (const e of cancelled)
                lines.push(`- ~~${e.title}~~`);
            lines.push('');
        }
        return lines.join('\n');
    }
    async createCategory(name) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(name));
        if (fs.existsSync(categoryPath)) {
            throw new Error(`Category "${name}" already exists`);
        }
        fs.mkdirSync(categoryPath, { recursive: true });
        const configPath = path.join(categoryPath, '.config.json');
        fs.writeFileSync(configPath, JSON.stringify({ color: this.defaultCategoryColor }, null, 2), 'utf-8');
    }
    async renameCategory(categoryName, newName) {
        const rootPath = this.ensureStoragePath();
        const currentPath = path.join(rootPath, this.sanitizePathName(categoryName));
        if (!fs.existsSync(currentPath)) {
            throw new Error('Category not found');
        }
        const trimmed = newName.trim();
        if (!trimmed) {
            throw new Error('Name is required');
        }
        const newPath = path.join(rootPath, this.sanitizePathName(trimmed));
        if (newPath === currentPath) {
            return path.basename(currentPath);
        }
        if (fs.existsSync(newPath)) {
            throw new Error(`Category "${trimmed}" already exists`);
        }
        fs.renameSync(currentPath, newPath);
        return path.basename(newPath);
    }
    canDeleteCategory(categoryName) {
        return this.canDeleteCategorySync(categoryName);
    }
    async deleteCategory(categoryName) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
        if (!fs.existsSync(categoryPath)) {
            throw new Error('Category not found');
        }
        if (!this.canDeleteCategorySync(categoryName)) {
            throw new Error('Category must be empty before deleting');
        }
        const configPath = path.join(categoryPath, '.config.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        fs.rmdirSync(categoryPath);
    }
    async createFolder(parentPath, name) {
        const sanitized = this.sanitizePathName(name);
        const folderPath = path.join(parentPath, sanitized);
        if (fs.existsSync(folderPath)) {
            throw new Error(`Folder "${name}" already exists`);
        }
        fs.mkdirSync(folderPath, { recursive: true });
        return folderPath;
    }
    _isFolderEmpty(dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.every((e) => e.name === '.config.json' || e.name.startsWith('.'));
    }
    async deleteFolder(folderPath) {
        if (!fs.existsSync(folderPath)) {
            throw new Error('Folder not found');
        }
        if (!this._isFolderEmpty(folderPath)) {
            throw new Error('Folder is not empty. Remove all files and subfolders first.');
        }
        fs.rmSync(folderPath, { recursive: true, force: true });
    }
    async renameFolder(folderPath, newName) {
        if (!fs.existsSync(folderPath)) {
            throw new Error('Folder not found');
        }
        const trimmed = newName.trim();
        if (!trimmed) {
            throw new Error('Name is required');
        }
        const parentPath = path.dirname(folderPath);
        const sanitized = this.sanitizePathName(trimmed);
        const newPath = path.join(parentPath, sanitized);
        if (newPath === folderPath) {
            return folderPath;
        }
        const targetName = path.basename(newPath).toLowerCase();
        const collision = fs.readdirSync(parentPath).some((entryName) => {
            const entryPath = path.join(parentPath, entryName);
            return entryName.toLowerCase() === targetName && entryPath !== folderPath;
        });
        if (collision) {
            throw new Error(`Folder "${trimmed}" already exists`);
        }
        fs.renameSync(folderPath, newPath);
        return newPath;
    }
    async importContent(content, notePath, onDuplicate) {
        const fileType = this.getFileType(path.basename(notePath));
        if (fileType === 'md') {
            const existing = await this.readNote(notePath);
            await this.saveNote(notePath, existing + '\n' + content);
            return;
        }
        let newEntries;
        try {
            const trimmed = content.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(trimmed);
                newEntries = Array.isArray(parsed) ? parsed : [parsed];
            }
            else {
                newEntries = this._parseTextToEntries(content, fileType);
            }
        }
        catch {
            newEntries = this._parseTextToEntries(content, fileType);
        }
        if (newEntries.length === 0) {
            throw new Error('No recognizable content found to import');
        }
        newEntries = newEntries.map((e) => this._deduceEntryTitle(e, fileType));
        switch (fileType) {
            case 'key': {
                const current = await this.readKeyEntries(notePath);
                const merged = [...current.entries, ...newEntries];
                await this.saveKeyEntries(notePath, merged, current.locked);
                break;
            }
            case 'command': {
                const current = await this.readCommandEntries(notePath);
                const merged = [...current, ...newEntries];
                await this.saveCommandEntries(notePath, merged);
                break;
            }
            case 'link': {
                const current = await this.readLinkEntries(notePath);
                const existingUrls = new Set(current.map((e) => e.url));
                const cleanNew = newEntries.map((e) => ({
                    title: String(e.title || '').trim(),
                    url: String(e.url || '').trim(),
                    description: String(e.description || '').trim() || undefined,
                }));
                const merged = [...current, ...cleanNew.filter((e) => !existingUrls.has(e.url))];
                await this.saveLinkEntries(notePath, merged);
                break;
            }
            case 'todo': {
                const current = await this.readTodoEntries(notePath);
                const merged = await this._mergeWithDuplicateCheck(current, newEntries, 'id', onDuplicate);
                await this.saveTodoEntries(notePath, merged);
                const folderPath = path.dirname(notePath);
                const fileName = path.basename(notePath);
                const active = merged.filter((e) => e.status !== 'cancelled');
                const progress = active.length === 0 ? 0
                    : Math.round(active.reduce((s, e) => s + Math.max(0, Math.min(100, Number(e.progress) || 0)), 0) / active.length);
                await this.updateCategoryFileProgress(folderPath, fileName, progress);
                break;
            }
            case 'snippet': {
                const current = await this.readSnippetEntries(notePath);
                const merged = [...current, ...newEntries];
                await this.saveSnippetEntries(notePath, merged);
                break;
            }
            case 'reminder': {
                const current = await this.readReminderEntries(notePath);
                const merged = await this._mergeWithDuplicateCheck(current, newEntries, 'id', onDuplicate);
                await this.saveReminderEntries(notePath, merged);
                break;
            }
        }
    }
    async _mergeWithDuplicateCheck(current, incoming, idField, onDuplicate) {
        const existingIds = new Set(current.map((e) => e[idField]).filter(Boolean));
        const duplicates = [];
        const cleanIncoming = [];
        for (const entry of incoming) {
            const id = entry[idField];
            if (id && existingIds.has(id)) {
                const match = current.find((e) => e[idField] === id);
                duplicates.push({ existing: match, imported: entry });
            }
            else {
                cleanIncoming.push(entry);
            }
        }
        if (duplicates.length === 0 || !onDuplicate) {
            return [...current, ...incoming];
        }
        const strategy = await onDuplicate(duplicates);
        if (strategy === null) {
            throw new Error('Import cancelled');
        }
        switch (strategy) {
            case 'replace':
                return current.map((e) => {
                    const dup = duplicates.find((d) => d.existing[idField] === e[idField]);
                    return dup ? dup.imported : e;
                }).concat(cleanIncoming);
            case 'skip':
                return [...current, ...cleanIncoming];
            case 'add':
            default:
                return [...current, ...incoming];
        }
    }
    async decryptFileContent(filePath, password) {
        try {
            const encrypted = fs.readFileSync(filePath, 'utf-8');
            return this.crypto.decryptFileContent(encrypted, password);
        }
        catch {
            return null;
        }
    }
    async tryDecryptKeyEntries(entries, vaultPath, password) {
        try {
            const configPath = path.join(vaultPath, '.config.json');
            if (!fs.existsSync(configPath))
                return null;
            const raw = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(raw);
            const vault = config.vault;
            if (!vault || typeof vault !== 'object')
                return null;
            let key = null;
            if (vault.mode === 'plain' && typeof vault.key === 'string') {
                key = Buffer.from(vault.key, 'base64');
            }
            else if (vault.mode === 'password' && password) {
                const salt = Buffer.from(vault.salt, 'hex');
                const storedHash = Buffer.from(vault.hash, 'hex');
                const encryptedKey = Buffer.from(vault.encryptedKey, 'base64');
                const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
                const hash = crypto.createHash('sha256').update(derivedKey).digest();
                if (!crypto.timingSafeEqual(hash, storedHash))
                    return null;
                const IV_LENGTH = 16;
                const AUTH_TAG_LENGTH = 16;
                const iv = encryptedKey.subarray(0, IV_LENGTH);
                const authTag = encryptedKey.subarray(encryptedKey.length - AUTH_TAG_LENGTH);
                const ciphertext = encryptedKey.subarray(IV_LENGTH, encryptedKey.length - AUTH_TAG_LENGTH);
                const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
                decipher.setAuthTag(authTag);
                key = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            }
            if (!key)
                return null;
            const IV_LENGTH = 16;
            const AUTH_TAG_LENGTH = 16;
            return entries.map((e) => {
                if (!e.password || e.password.length < 20)
                    return e;
                try {
                    const payload = Buffer.from(e.password, 'base64');
                    const iv = payload.subarray(0, IV_LENGTH);
                    const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
                    const data = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
                    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                    decipher.setAuthTag(authTag);
                    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
                    return { ...e, password: decrypted };
                }
                catch {
                    return e;
                }
            });
        }
        catch {
            return null;
        }
    }
    _parseTextToEntries(text, fileType) {
        const lines = text.split('\n').filter((l) => l.trim());
        if (fileType === 'key') {
            const knownFields = {
                username: 'username', user: 'username', nick: 'username', login: 'username',
                password: 'password', pass: 'password', pw: 'password', passwd: 'password',
                email: 'email', mail: 'email', e: 'email',
                url: 'url', uri: 'url', website: 'url', site: 'url', link: 'url',
                host: 'host', server: 'host', hostname: 'host',
                port: 'port',
                token: 'token', api_key: 'token', apikey: 'token', api: 'token', key: 'token',
                note: 'note', notes: 'note', description: 'note', desc: 'note', comment: 'note',
                title: 'title', name: 'title', label: 'title', service: 'title', account: 'title',
            };
            return this._parseKeyValueLines(lines, knownFields, 'note');
        }
        if (fileType === 'command') {
            const knownFields = {
                title: 'title', name: 'title', command: 'command', cmd: 'command', code: 'command', script: 'command',
            };
            const result = this._parseKeyValueLines(lines, knownFields, 'command');
            if (result.length === 0) {
                const single = {};
                single.title = this._extractTitle(lines.join(' ')) || 'Imported command';
                single.command = lines.join('\n');
                return [single];
            }
            return result;
        }
        if (fileType === 'link') {
            const csvLine = /^(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.*))?$/;
            const hasPipe = lines.some((l) => l.includes('|'));
            if (hasPipe) {
                const csvResult = [];
                for (const line of lines) {
                    const m = line.match(csvLine);
                    if (m) {
                        csvResult.push({
                            url: m[1].trim(),
                            title: m[2].trim(),
                            description: m[3]?.trim() || undefined,
                        });
                    }
                    else if (/^https?:\/\//.test(line.trim())) {
                        csvResult.push({
                            url: line.trim(),
                            title: '',
                        });
                    }
                }
                if (csvResult.length > 0)
                    return csvResult;
            }
            const knownFields = {
                title: 'title', name: 'title', url: 'url', uri: 'url', link: 'url', description: 'description', desc: 'description', note: 'description',
            };
            const result = this._parseKeyValueLines(lines, knownFields, 'url');
            if (result.length === 0) {
                const singleUrl = lines.find((l) => /^https?:\/\//.test(l.trim()));
                if (singleUrl) {
                    return [{ url: singleUrl.trim(), title: '' }];
                }
                const single = {};
                single.title = this._extractTitle(lines.join(' ')) || 'Imported link';
                single.url = lines.join('\n');
                return [single];
            }
            return result;
        }
        if (fileType === 'todo') {
            const entries = [];
            let current = {};
            const taskLine = /^\s*[-*]\s+(\[.?\])\s+(.+)|^\s*[-*]\s+(.+)|^\s*\d+[.)]\s+(.+)/;
            for (const line of lines) {
                if (line.trim() === '---') {
                    if (current.title)
                        entries.push({ ...current });
                    current = {};
                    continue;
                }
                const m = line.match(taskLine);
                if (m) {
                    if (current.title)
                        entries.push({ ...current });
                    current = {};
                    const check = m[1] || '';
                    const text = m[2] || m[3] || m[4] || '';
                    current.title = text.trim();
                    if (check.includes('x') || check.includes('X')) {
                        current.status = 'done';
                        current.progress = 100;
                    }
                    else {
                        current.status = 'open';
                        current.progress = 0;
                    }
                    continue;
                }
                const pi = line.match(/\((\d+)%\)/);
                if (pi)
                    current.progress = Math.max(0, Math.min(100, parseInt(pi[1], 10)));
                const pri = line.match(/priority:\s*(high|medium|low)/i);
                if (pri)
                    current.priority = pri[1].toLowerCase();
                else
                    current.priority = 'medium';
                const du = line.match(/due:\s*(.+)/i);
                if (du)
                    current.dueAt = du[1].trim();
            }
            if (current.title)
                entries.push({ ...current });
            if (entries.length === 0) {
                entries.push({ title: lines[0]?.trim() || 'Task', progress: 0, status: 'open', priority: 'medium' });
            }
            return entries;
        }
        if (fileType === 'snippet') {
            const codeBlocks = text.match(/```(\w*)\n([\s\S]*?)```/g);
            if (codeBlocks) {
                return codeBlocks.map((block) => {
                    const langMatch = block.match(/```(\w*)\n/);
                    const lang = langMatch?.[1] || 'text';
                    const code = block.replace(/```\w*\n/, '').replace(/```$/, '').trim();
                    return { title: code.split('\n')[0]?.slice(0, 60) || 'Snippet', language: lang, code };
                });
            }
            const knownFields = {
                title: 'title', name: 'title', language: 'language', lang: 'language', code: 'code', snippet: 'code',
            };
            return this._parseKeyValueLines(lines, knownFields, 'code');
        }
        return [{ content: text }];
    }
    _parseKeyValueLines(lines, knownFields, fallbackField) {
        const entries = [];
        let current = {};
        let extraNotes = [];
        let hasContent = false;
        const flush = () => {
            if (hasContent) {
                if (extraNotes.length > 0 && !current[fallbackField]) {
                    current[fallbackField] = extraNotes.join('\n');
                }
                else if (extraNotes.length > 0 && current[fallbackField]) {
                    current[fallbackField] += '\n' + extraNotes.join('\n');
                }
                entries.push({ ...current });
            }
            current = {};
            extraNotes = [];
            hasContent = false;
        };
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                flush();
                continue;
            }
            if (trimmed === '---') {
                flush();
                continue;
            }
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0) {
                const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
                const value = trimmed.slice(colonIdx + 1).trim();
                const mapped = knownFields[key];
                if (mapped) {
                    current[mapped] = value;
                    hasContent = true;
                }
                else {
                    extraNotes.push(trimmed);
                    hasContent = true;
                }
            }
            else {
                extraNotes.push(trimmed);
                hasContent = true;
            }
        }
        flush();
        if (entries.length === 0) {
            const single = {};
            single[fallbackField] = lines.join('\n');
            entries.push(single);
        }
        return entries;
    }
    _deduceEntryTitle(entry, fileType) {
        if (entry.title && entry.title.trim())
            return entry;
        if (fileType === 'key') {
            entry.title = entry.username || entry.email || entry.host || entry.url || entry.token || entry.note || 'Imported entry';
            if (entry.title.length > 60)
                entry.title = entry.title.slice(0, 60);
        }
        else if (fileType === 'command') {
            const cmd = (entry.command || '').split('\n')[0];
            entry.title = entry.title || cmd?.slice(0, 60) || 'Imported command';
        }
        else if (fileType === 'todo') {
            entry.title = entry.title || 'Task';
        }
        else if (fileType === 'snippet') {
            entry.title = entry.title || (entry.code || '').split('\n')[0]?.slice(0, 60) || 'Imported snippet';
        }
        else if (fileType === 'reminder') {
            entry.title = entry.text || entry.title || 'Reminder';
        }
        else if (fileType === 'link') {
            const u = (entry.url || '').split('\n')[0];
            entry.title = entry.title || u?.slice(0, 60) || 'Imported link';
        }
        return entry;
    }
    _extractTitle(text) {
        const patterns = [
            /^#+\s+(.+)/m,
            /^(?:title|name):\s*(.+)/im,
            /^(?:https?:\/\/[^\s]+)/,
            /^([^\n]{3,60})/,
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m)
                return m[1]?.trim() || m[0]?.trim();
        }
        return undefined;
    }
    analyzeSelection(text) {
        const trimmed = text.trim();
        if (!trimmed)
            return null;
        const isJsonObject = trimmed.startsWith('{');
        const isJsonArray = trimmed.startsWith('[');
        if (isJsonObject || isJsonArray) {
            try {
                const parsed = JSON.parse(trimmed);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                if (items.length > 0 && typeof items[0] === 'object') {
                    const keys = Object.keys(items[0]).map((k) => k.toLowerCase());
                    const keyPatterns = ['password', 'pass', 'username', 'user', 'email', 'url', 'host', 'port', 'token'];
                    const commandPatterns = ['command', 'cmd', 'script'];
                    const todoPatterns = ['progress', 'status', 'priority', 'due'];
                    const snippetPatterns = ['language', 'lang', 'code', 'snippet'];
                    const reminderPatterns = ['dueat', 'text', 'action'];
                    const hasKey = keyPatterns.some((p) => keys.includes(p));
                    const hasCommand = commandPatterns.some((p) => keys.includes(p));
                    const hasTodo = todoPatterns.some((p) => keys.includes(p));
                    const hasSnippet = snippetPatterns.some((p) => keys.includes(p));
                    const hasReminder = reminderPatterns.some((p) => keys.includes(p));
                    if (hasKey && !hasCommand && !hasSnippet && !hasReminder) {
                        return { title: items[0].title || items[0].name || items[0].username || items[0].email || 'Imported', type: 'key' };
                    }
                    if (hasSnippet) {
                        return { title: items[0].title || items[0].name || 'Snippet', type: 'snippet' };
                    }
                    if (hasCommand) {
                        return { title: items[0].title || items[0].name || 'Command', type: 'command' };
                    }
                    if (hasTodo) {
                        return { title: items[0].title || 'Task', type: 'todo' };
                    }
                    if (hasReminder) {
                        return { title: items[0].text || items[0].title || 'Reminder', type: 'reminder' };
                    }
                    return { title: items[0].title || items[0].name || 'Entry', type: 'key' };
                }
                return null;
            }
            catch {
                return null;
            }
        }
        const hasCodeBlock = /```\w*\n[\s\S]*?```/.test(trimmed);
        if (hasCodeBlock) {
            return { title: this._extractTitle(trimmed) || 'Snippet', type: 'snippet' };
        }
        const lines = trimmed.split('\n').filter((l) => l.trim());
        const colonPairs = lines.filter((l) => l.includes(':') && !l.trim().startsWith('#'));
        const keyLike = ['password', 'pass', 'pw', 'username', 'user', 'email', 'mail', 'url', 'host', 'port', 'token', 'api'];
        const hasKeyFields = colonPairs.some((l) => {
            const k = l.split(':')[0].trim().toLowerCase();
            return keyLike.includes(k);
        });
        if (hasKeyFields) {
            const title = this._extractTitle(trimmed) || lines[0]?.split(':')[1]?.trim() || 'Imported key';
            return { title, type: 'key' };
        }
        const hasTaskMarker = /^\s*[-*]\s+\[.?\]/.test(trimmed) || /^\s*[-*]\s+/.test(trimmed);
        if (hasTaskMarker) {
            return { title: 'Tasks', type: 'todo' };
        }
        if (colonPairs.length > 0) {
            const cmdLike = colonPairs.some((l) => {
                const k = l.split(':')[0].trim().toLowerCase();
                return ['command', 'cmd', 'title', 'name'].includes(k);
            });
            if (cmdLike) {
                return { title: this._extractTitle(trimmed) || 'Command', type: 'command' };
            }
        }
        const firstLine = lines[0]?.trim();
        if (firstLine) {
            const isUrl = /^https?:\/\//.test(firstLine);
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firstLine);
            if (isUrl || isEmail) {
                return { title: firstLine.slice(0, 60), type: 'key' };
            }
        }
        return { title: this._extractTitle(trimmed) || firstLine?.slice(0, 60) || 'Note', type: 'md' };
    }
    async moveItem(sourcePath, targetDir) {
        if (!fs.existsSync(sourcePath)) {
            throw new Error('Source not found');
        }
        if (!fs.existsSync(targetDir)) {
            throw new Error('Target directory not found');
        }
        const itemName = path.basename(sourcePath);
        const destPath = path.join(targetDir, itemName);
        if (fs.existsSync(destPath)) {
            throw new Error(`"${itemName}" already exists in target`);
        }
        const stat = fs.statSync(sourcePath);
        fs.renameSync(sourcePath, destPath);
    }
    getFolderTree(dirPath) {
        if (!fs.existsSync(dirPath))
            return [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const nodes = [];
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                const fullPath = path.join(dirPath, entry.name);
                nodes.push({
                    name: entry.name,
                    path: fullPath,
                    children: this.getFolderTree(fullPath),
                });
            }
        }
        return nodes.sort((a, b) => a.name.localeCompare(b.name));
    }
    getNotesRecursive(dirPath) {
        const result = [];
        if (!fs.existsSync(dirPath))
            return result;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (entry.name.endsWith('.anemona-shot') && this.isValidShotFolder(fullPath)) {
                    result.push({
                        name: entry.name,
                        filePath: fullPath,
                        content: '',
                        fileType: 'shot',
                    });
                }
                else {
                    result.push(...this.getNotesRecursive(fullPath));
                }
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet' || ext === '.anemona-reminder' || ext === '.anemona-link') {
                    result.push({
                        name: entry.name,
                        filePath: fullPath,
                        content: '',
                        fileType: this.getFileType(entry.name),
                    });
                }
            }
        }
        return result;
    }
    async exportVault(outputPath) {
        const rootPath = this.ensureStoragePath();
        await ZipService.createArchive(rootPath, outputPath);
    }
    scanZipContents(zipPath) {
        return ZipService.scanZipContents(zipPath);
    }
    async importVault(zipPath, mode) {
        const rootPath = this.ensureStoragePath();
        if (mode === 'overwrite') {
            await ZipService.extractArchive(zipPath, rootPath);
            return;
        }
        const tmpDir = path.join(rootPath, '.import-tmp-' + Date.now());
        fs.mkdirSync(tmpDir, { recursive: true });
        try {
            await ZipService.extractArchive(zipPath, tmpDir);
            const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
            for (const entry of entries) {
                const src = path.join(tmpDir, entry.name);
                const dest = path.join(rootPath, entry.name);
                if (entry.isDirectory()) {
                    this._mergeDirectory(src, dest);
                }
                else if (!fs.existsSync(dest)) {
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    fs.copyFileSync(src, dest);
                }
            }
        }
        finally {
            this._rmRecursive(tmpDir);
        }
    }
    _mergeDirectory(srcDir, destDir) {
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const entries = fs.readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
            const src = path.join(srcDir, entry.name);
            const dest = path.join(destDir, entry.name);
            if (entry.isDirectory()) {
                this._mergeDirectory(src, dest);
            }
            else if (!fs.existsSync(dest)) {
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(src, dest);
            }
        }
    }
    _rmRecursive(dir) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this._rmRecursive(full);
            }
            else {
                fs.unlinkSync(full);
            }
        }
        fs.rmdirSync(dir);
    }
    isEmptyKeyFile(notePath) {
        if (!fs.existsSync(notePath)) {
            return true;
        }
        try {
            const raw = fs.readFileSync(notePath, 'utf-8').trim();
            if (!raw)
                return true;
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                return data.length === 0;
            }
            if (data && typeof data === 'object') {
                const entries = Array.isArray(data.entries)
                    ? data.entries
                    : [];
                return entries.length === 0;
            }
        }
        catch {
            return false;
        }
        return false;
    }
    canDeleteCategorySync(categoryName) {
        const rootPath = this.ensureStoragePath();
        const categoryPath = path.join(rootPath, this.sanitizePathName(categoryName));
        if (!fs.existsSync(categoryPath)) {
            return false;
        }
        return this._isFolderEmpty(categoryPath);
    }
    detectFullExtension(fileName) {
        if (fileName.endsWith('.anemona-lock'))
            return '.anemona-lock';
        if (fileName.endsWith('.anemona-key'))
            return '.anemona-key';
        if (fileName.endsWith('.anemona-command'))
            return '.anemona-command';
        if (fileName.endsWith('.anemona-todo'))
            return '.anemona-todo';
        if (fileName.endsWith('.anemona-snippet'))
            return '.anemona-snippet';
        if (fileName.endsWith('.anemona-reminder'))
            return '.anemona-reminder';
        if (fileName.endsWith('.anemona-shot'))
            return '.anemona-shot';
        if (fileName.endsWith('.anemona-link'))
            return '.anemona-link';
        if (fileName.endsWith('.md'))
            return '.md';
        return path.extname(fileName);
    }
    sanitizePathName(name) {
        return name
            .trim()
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '-')
            .replace(/\.\./g, '');
    }
}
exports.NotesService = NotesService;
//# sourceMappingURL=NotesService.js.map