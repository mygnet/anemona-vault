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
const path = __importStar(require("path"));
const ZipService = __importStar(require("./ZipService"));
const ConfigService_1 = require("./ConfigService");
const CryptoService_1 = require("./CryptoService");
class NotesService {
    constructor() {
        this._crypto = null;
        this.defaultCategoryColor = 'vscode-soft';
        this.categoryColors = [
            'vscode-default', 'vscode-muted', 'vscode-soft',
            '#e17076', '#f5a623', '#f7dc6f', '#68c3a0',
            '#54a0ff', '#a29bfe', '#fd79a8', '#00cec9', '#d8dee9',
            '#6c5ce7', '#e84393', '#00b894', '#0984e3', '#f5f7fa',
        ];
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
            .replace(/\.md$/, '');
    }
    async initializeDefaultCategories(rootPath) {
        const categories = ConfigService_1.ConfigService.getDefaultCategories();
        let colorIndex = 0;
        for (const category of categories) {
            const dir = path.join(rootPath, this.sanitizePathName(category));
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const configPath = path.join(dir, '.config.json');
            if (!fs.existsSync(configPath)) {
                const color = this.defaultCategoryColor;
                fs.writeFileSync(configPath, JSON.stringify({ color }, null, 2), 'utf-8');
                colorIndex++;
            }
        }
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
        await this.writeCategoryConfig(categoryName, {
            ...current,
            color,
        });
    }
    async updateFolderColor(folderPath, color) {
        const current = this.readCategoryConfigSync(folderPath) ?? {};
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
                    if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet') {
                        const filePath = path.join(categoryPath, entry.name);
                        notes.push({
                            name: entry.name,
                            filePath,
                            content: '',
                            fileType: this.getFileType(entry.name),
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
                    const config = this.readCategoryConfigSync(fullPath);
                    const isEmpty = this._isFolderEmpty(fullPath);
                    folders.push({
                        name: entry.name,
                        path: fullPath,
                        color: config?.color,
                        isEmpty,
                    });
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet') {
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
        return Array.isArray(data) ? data : [];
    }
    async saveCommandEntries(notePath, entries) {
        fs.writeFileSync(notePath, JSON.stringify(entries, null, 2), 'utf-8');
    }
    async readTodoEntries(notePath) {
        const raw = await this.readNote(notePath);
        const data = JSON.parse(raw);
        if (!Array.isArray(data))
            return [];
        return data.map((entry) => ({
            id: String(entry?.id || '') || undefined,
            title: String(entry?.title || '').trim(),
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
            const match = entries.find((entry) => [entry.title, entry.command].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Command', match.command || match.title);
        }
        if (note.fileType === 'todo') {
            const entries = await this.readTodoEntries(note.filePath);
            const match = entries.find((entry) => [entry.title, entry.status, entry.priority].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
            if (!match)
                return null;
            return this.toSearchResult(categoryName, note, match.title || 'Task', `${match.title} ${match.priority} ${match.status}`);
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
        if (fs.existsSync(newPath)) {
            throw new Error(`Note "${trimmed}" already exists`);
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
                const lines = entries.map((e, i) => `${i + 1}. ${e.title}\n   $ ${e.command}`);
                return { content: lines.join('\n'), language: 'plaintext' };
            }
            if (format === 'markdown') {
                const md = entries.map(e => `### ${e.title}\n\n\`\`\`bash\n${e.command}\n\`\`\``).join('\n\n');
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
        this.writeCategoryConfigSync(folderPath, { color: this.defaultCategoryColor });
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
        if (fs.existsSync(newPath)) {
            throw new Error(`Folder "${trimmed}" already exists`);
        }
        fs.renameSync(folderPath, newPath);
        return newPath;
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
                result.push(...this.getNotesRecursive(fullPath));
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (ext === '.md' || ext === '.anemona-key' || ext === '.anemona-command' || ext === '.anemona-lock' || ext === '.anemona-todo' || ext === '.anemona-snippet') {
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