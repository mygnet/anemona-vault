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
exports.NotesViewProvider = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const ConfigService_1 = require("./../services/ConfigService");
class NotesViewProvider {
    constructor(_extensionUri, notesService, globalState) {
        this._extensionUri = _extensionUri;
        this._currentNotePath = null;
        this._currentCategory = null;
        this._currentFolderPath = '';
        this._globalState = null;
        this._notesService = notesService;
        this._globalState = globalState ?? null;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'media', 'icons'),
            ],
        };
        webviewView.webview.html = this._getHtmlContent(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this._handleMessage(message);
        });
    }
    async _handleMessage(message) {
        switch (message.command) {
            case 'ready':
                this._loadCategories();
                break;
            case 'selectCategory':
                this._currentCategory = message.category;
                this._currentFolderPath = message.folderPath || '';
                await this._loadNotes(this._currentCategory, this._currentFolderPath);
                break;
            case 'selectNote':
                await this._loadNoteContent(message.category, message.note);
                break;
            case 'createNote':
                this._currentFolderPath = message.folderPath || this._currentFolderPath;
                await this._createNote(message.category, message.title, message.fileType || 'md');
                break;
            case 'saveNote':
                await this._saveNote(message.notePath, message.content);
                break;
            case 'deleteNote':
                await this._deleteNote(message.notePath);
                break;
            case 'renameNote':
                await this._renameNote(message.notePath, message.title);
                break;
            case 'moveNote':
                await this._moveNote(message.notePath, message.targetCategory, message.targetFolderPath);
                break;
            case 'openFolder':
                this._currentFolderPath = message.folderPath;
                await this._loadNotes(this._currentCategory || message.category, this._currentFolderPath);
                break;
            case 'createFolder':
                await this._createFolder(message.parentPath, message.name);
                break;
            case 'deleteFolder':
                await this._deleteFolder(message.folderPath);
                break;
            case 'renameFolder':
                await this._renameFolder(message.folderPath, message.name);
                break;
            case 'moveFolder':
                await this._moveFolder(message.sourcePath, message.targetDir);
                break;
            case 'updateFolderColor':
                await this._updateFolderColor(message.folderPath, message.color);
                break;
            case 'getFolderTree':
                await this._sendFolderTree(message.categoryName);
                break;
            case 'exportNote':
                await this._exportNote(message.notePath, message.format);
                break;
            case 'createCategory':
                await this._createCategory(message.name);
                break;
            case 'deleteCategory':
                await this._deleteCategory(message.category);
                break;
            case 'renameCategory':
                await this._renameCategory(message.category, message.name);
                break;
            case 'updateCategoryColor':
                await this._updateCategoryColor(message.category, message.color);
                break;
            case 'selectStorageFolder':
                await this.setStoragePath();
                break;
            case 'refresh':
                this._loadCategories();
                break;
            case 'unlockVault':
                await this._unlockVault(message.password);
                break;
            case 'lockVault':
                await this._lockVault(message.password);
                break;
            case 'saveKeyEntries':
                await this._saveKeyEntries(message.notePath, message.entries, message.locked);
                break;
            case 'saveCommandEntries':
                await this._saveCommandEntries(message.notePath, message.entries);
                break;
            case 'saveTodoEntries':
                await this._saveTodoEntries(message.notePath, message.entries);
                break;
            case 'saveSnippetEntries':
                await this._saveSnippetEntries(message.notePath, message.entries);
                break;
            case 'searchGlobal':
                await this._searchGlobal(String(message.query || ''));
                break;
            case 'openRecentFolder':
                await this._openRecentFolder(message.folderPath);
                break;
            case 'getRecentFolders':
                await this._sendRecentFolders();
                break;
        }
    }
    _loadCategories() {
        const storagePath = this._notesService.getStoragePath();
        if (!storagePath) {
            this._updateViewTitle();
            this._postMessage({
                command: 'storagePathRequired',
                recentFolders: this._getRecentFolders(),
            });
            return;
        }
        this._updateViewTitle();
        const categories = this._notesService.getCategories();
        const rootCategoryConfig = this._notesService.readRootCategoryConfig();
        this._postMessage({
            command: 'categoriesLoaded',
            categories: categories.map((c) => ({
                name: c.name,
                path: c.path,
                config: rootCategoryConfig ? { ...rootCategoryConfig, ...c.config } : c.config,
                canDelete: c.canDelete === true,
            })),
        });
    }
    _getRecentFolders() {
        if (!this._globalState)
            return [];
        const stored = this._globalState.get('recentFolders', []);
        return stored
            .filter((f) => fs.existsSync(f.path))
            .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
            .slice(0, 8);
    }
    _addRecentFolder(folderPath) {
        if (!this._globalState)
            return;
        const stored = this._globalState.get('recentFolders', []);
        const name = path.basename(path.normalize(folderPath));
        let icon;
        const rootConfigPath = path.join(folderPath, '.config.json');
        if (fs.existsSync(rootConfigPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(rootConfigPath, 'utf-8'));
                icon = config.icon;
            }
            catch {
                // ignore invalid config
            }
        }
        const entry = {
            path: folderPath,
            name,
            icon,
            lastOpened: new Date().toISOString(),
        };
        const filtered = stored.filter((f) => f.path !== folderPath);
        filtered.unshift(entry);
        this._globalState.update('recentFolders', filtered.slice(0, 16));
    }
    _removeRecentFolder(folderPath) {
        if (!this._globalState)
            return;
        const stored = this._globalState.get('recentFolders', []);
        this._globalState.update('recentFolders', stored.filter((f) => f.path !== folderPath));
    }
    async _openRecentFolder(folderPath) {
        if (!fs.existsSync(folderPath)) {
            this._removeRecentFolder(folderPath);
            this._postMessage({
                command: 'error',
                message: `Folder "${folderPath}" no longer exists`,
            });
            this._loadCategories();
            return;
        }
        await ConfigService_1.ConfigService.setStoragePath(folderPath);
        this._notesService.setStoragePath(folderPath);
        this._addRecentFolder(folderPath);
        this._updateViewTitle();
        this._loadCategories();
    }
    async _sendRecentFolders() {
        this._postMessage({
            command: 'recentFolders',
            recentFolders: this._getRecentFolders(),
        });
    }
    async _loadNotes(categoryName, folderPath) {
        const contents = this._notesService.getFolderContents(categoryName, folderPath);
        const effectiveConfig = this._notesService.getMergedConfig(categoryName, folderPath);
        const fileCache = effectiveConfig?.file ?? {};
        const relativeFolderPath = folderPath || '';
        const parentFolder = relativeFolderPath
            ? relativeFolderPath.split('/').slice(0, -1).join('/')
            : null;
        this._postMessage({
            command: 'notesLoaded',
            category: categoryName,
            currentFolder: relativeFolderPath,
            parentFolder: parentFolder || null,
            effectiveConfig,
            folders: contents.folders.map((f) => ({
                name: f.name,
                path: f.path,
                color: f.color,
                isEmpty: f.isEmpty,
            })),
            notes: contents.notes.map((n) => ({
                name: n.name,
                filePath: n.filePath,
                fileType: n.fileType,
                displayName: this._notesService.getDisplayName(n.name),
                icon: this._notesService.getFileIcon(n.name),
                progress: n.fileType === 'todo' ? fileCache[n.name]?.progress : undefined,
            })),
        });
    }
    async _loadNoteContent(categoryName, noteName) {
        try {
            const categoryPath = path.join(this._notesService.getStoragePath() || '', categoryName);
            const allNotes = this._notesService.getNotesRecursive(categoryPath);
            const note = allNotes.find((n) => n.name === noteName);
            if (!note)
                return;
            this._currentNotePath = note.filePath;
            const fileType = note.fileType;
            const noteRelativeFolder = path.relative(categoryPath, path.dirname(note.filePath));
            const effectiveConfig = this._notesService.getMergedConfig(categoryName, noteRelativeFolder || undefined);
            const postNoteContent = (extra = {}) => {
                this._postMessage({
                    command: 'noteContent',
                    note: { name: note.name, filePath: note.filePath, fileType },
                    effectiveConfig,
                    ...extra,
                });
            };
            if (fileType === 'key') {
                if (this._notesService.isLockedFile(note.name)) {
                    postNoteContent({
                        fileType: 'key',
                        entries: [],
                        locked: true,
                    });
                }
                else {
                    const { entries, locked } = await this._notesService.readKeyEntries(note.filePath);
                    if (locked) {
                        postNoteContent({
                            fileType: 'key',
                            entries: entries,
                            locked: true,
                        });
                    }
                    else {
                        const decrypted = await this._notesService.readDecryptedKeyEntries(note.filePath);
                        postNoteContent({
                            fileType: 'key',
                            entries: decrypted,
                            locked: false,
                        });
                    }
                }
            }
            else if (fileType === 'command') {
                const entries = await this._notesService.readCommandEntries(note.filePath);
                postNoteContent({
                    fileType: 'command',
                    entries,
                });
            }
            else if (fileType === 'todo') {
                const entries = await this._notesService.readTodoEntries(note.filePath);
                postNoteContent({
                    fileType: 'todo',
                    entries,
                });
            }
            else if (fileType === 'snippet') {
                const entries = await this._notesService.readSnippetEntries(note.filePath);
                postNoteContent({
                    fileType: 'snippet',
                    entries,
                });
            }
            else {
                const content = await this._notesService.readNote(note.filePath);
                postNoteContent({
                    fileType: 'md',
                    content,
                });
            }
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to read note',
            });
        }
    }
    async _createNote(category, title, fileType) {
        try {
            const parentFolderPath = this._currentFolderPath
                ? path.join(this._notesService.getStoragePath() || '', category, this._currentFolderPath)
                : undefined;
            const note = await this._notesService.createNote(category, title, fileType, parentFolderPath);
            this._postMessage({
                command: 'noteCreated',
                note: {
                    name: note.name,
                    filePath: note.filePath,
                    fileType: note.fileType,
                },
            });
            this._loadCategories();
            this._loadNotes(this._currentCategory || category, this._currentFolderPath);
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to create note',
            });
        }
    }
    async _saveNote(notePath, content) {
        try {
            await this._notesService.saveNote(notePath, content);
            this._postMessage({ command: 'noteSaved' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to save note',
            });
        }
    }
    async _saveKeyEntries(notePath, entries, locked) {
        try {
            await this._notesService.saveKeyEntries(notePath, entries, locked);
            this._postMessage({ command: 'noteSaved' });
        }
        catch (err) {
            const message = err instanceof Error &&
                err.message === 'Vault is locked. Enter your password to unlock.'
                ? 'This folder still has a password-protected `.config.json`. Copy that file with the folder or reset the folder config before saving.'
                : err instanceof Error
                    ? err.message
                    : 'Failed to save entries';
            this._postMessage({
                command: 'error',
                message,
            });
        }
    }
    async _saveCommandEntries(notePath, entries) {
        try {
            await this._notesService.saveCommandEntries(notePath, entries);
            this._postMessage({ command: 'noteSaved' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to save entries',
            });
        }
    }
    async _saveTodoEntries(notePath, entries) {
        try {
            await this._notesService.saveTodoEntries(notePath, entries);
            const activeEntries = entries.filter((e) => e.status !== 'cancelled');
            const progress = activeEntries.length === 0
                ? 0
                : Math.round(activeEntries.reduce((sum, e) => sum + Math.max(0, Math.min(100, Number(e.progress) || 0)), 0) / activeEntries.length);
            const folderPath = path.dirname(notePath);
            const fileName = path.basename(notePath);
            await this._notesService.updateCategoryFileProgress(folderPath, fileName, progress);
            this._postMessage({ command: 'noteSaved' });
            const actualCategory = this._getCategoryFromNotePath(notePath) || this._currentCategory || '';
            this._loadNotes(actualCategory, this._currentFolderPath);
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to save todo entries',
            });
        }
    }
    async _saveSnippetEntries(notePath, entries) {
        try {
            await this._notesService.saveSnippetEntries(notePath, entries);
            this._postMessage({ command: 'noteSaved' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to save snippet entries',
            });
        }
    }
    async _searchGlobal(query) {
        try {
            const results = await this._notesService.searchAll(query);
            this._postMessage({
                command: 'globalSearchResults',
                query,
                results,
            });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to search vault',
            });
        }
    }
    async _deleteNote(notePath) {
        try {
            await this._notesService.deleteNote(notePath);
            if (this._currentNotePath === notePath) {
                this._currentNotePath = null;
            }
            const category = this._getCategoryFromNotePath(notePath);
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
            this._loadCategories();
            this._postMessage({ command: 'noteDeleted' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to delete note',
            });
        }
    }
    async _renameNote(notePath, title) {
        try {
            const newPath = await this._notesService.renameNote(notePath, title);
            const category = this._getCategoryFromNotePath(newPath);
            if (this._currentNotePath === notePath) {
                this._currentNotePath = newPath;
            }
            this._postMessage({ command: 'noteRenamed', notePath, newPath });
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
            this._loadCategories();
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to rename note',
            });
        }
    }
    async _moveNote(notePath, targetCategory, targetFolderPath) {
        try {
            const sourceCategory = this._getCategoryFromNotePath(notePath);
            if (targetFolderPath) {
                const rootPath = this._notesService.getStoragePath();
                const storagePath = rootPath || '';
                const targetDir = path.join(storagePath, targetCategory, targetFolderPath);
                await this._notesService.moveItem(notePath, targetDir);
            }
            else {
                await this._notesService.moveNote(notePath, targetCategory);
            }
            this._postMessage({ command: 'noteMoved', notePath, targetCategory });
            if (sourceCategory) {
                this._loadNotes(sourceCategory, this._currentFolderPath);
            }
            this._loadCategories();
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to move note',
            });
        }
    }
    async _createFolder(parentPath, name) {
        try {
            await this._notesService.createFolder(parentPath, name);
            const category = this._getCategoryFromNotePath(parentPath) || this._currentCategory;
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to create folder',
            });
        }
    }
    async _deleteFolder(folderPath) {
        try {
            await this._notesService.deleteFolder(folderPath);
            const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory;
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
            this._loadCategories();
            this._postMessage({ command: 'folderDeleted' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to delete folder',
            });
        }
    }
    async _renameFolder(folderPath, name) {
        try {
            await this._notesService.renameFolder(folderPath, name);
            const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory;
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
            this._loadCategories();
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to rename folder',
            });
        }
    }
    async _moveFolder(sourcePath, targetDir) {
        try {
            await this._notesService.moveItem(sourcePath, targetDir);
            const sourceCategory = this._getCategoryFromNotePath(sourcePath) || this._currentCategory;
            this._postMessage({ command: 'folderMoved', sourcePath, targetDir });
            if (sourceCategory) {
                this._loadNotes(sourceCategory, this._currentFolderPath);
                this._loadCategories();
            }
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to move item',
            });
        }
    }
    async _updateFolderColor(folderPath, color) {
        try {
            await this._notesService.updateFolderColor(folderPath, color);
            const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory;
            if (category) {
                this._loadNotes(category, this._currentFolderPath);
            }
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to update folder color',
            });
        }
    }
    async _sendFolderTree(categoryName) {
        try {
            const rootPath = this._notesService.getStoragePath();
            if (!rootPath)
                return;
            const categoryPath = path.join(rootPath, categoryName);
            const tree = this._notesService.getFolderTree(categoryPath);
            this._postMessage({
                command: 'folderTree',
                categoryName,
                tree,
            });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to get folder tree',
            });
        }
    }
    async _exportNote(notePath, format) {
        try {
            const { content, language } = await this._notesService.exportNote(notePath, format);
            const doc = await vscode.workspace.openTextDocument({
                content,
                language,
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to export note',
            });
        }
    }
    async _createCategory(name) {
        try {
            await this._notesService.createCategory(name);
            this._loadCategories();
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to create category',
            });
        }
    }
    async _deleteCategory(categoryName) {
        try {
            await this._notesService.deleteCategory(categoryName);
            this._currentNotePath = null;
            this._loadCategories();
            this._postMessage({ command: 'categoryDeleted', category: categoryName });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to delete category',
            });
        }
    }
    async _renameCategory(categoryName, name) {
        try {
            const newName = await this._notesService.renameCategory(categoryName, name);
            this._currentNotePath = null;
            this._postMessage({ command: 'categoryRenamed', category: categoryName, newName });
            this._loadCategories();
            this._loadNotes(newName, this._currentFolderPath);
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to rename category',
            });
        }
    }
    async _updateCategoryColor(categoryName, color) {
        try {
            await this._notesService.updateCategoryColor(categoryName, color);
            this._loadCategories();
            this._loadNotes(categoryName, this._currentFolderPath);
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to update category color',
            });
        }
    }
    async _unlockVault(password) {
        const notePath = this._currentNotePath;
        if (notePath && notePath.endsWith('.anemona-lock')) {
            const newPath = await this._notesService.unlockNoteFile(notePath, password);
            if (newPath) {
                this._currentNotePath = newPath;
                const noteName = path.basename(newPath);
                const category = this._getCategoryFromNotePath(newPath);
                this._loadNotes(category || '', this._currentFolderPath);
                await this._loadNoteContent(category || '', noteName);
            }
            else {
                this._postMessage({ command: 'error', message: 'Incorrect password' });
            }
        }
        else {
            this._postMessage({ command: 'error', message: 'No locked file selected' });
        }
    }
    _getCategoryFromNotePath(notePath) {
        const storagePath = this._notesService.getStoragePath();
        if (!storagePath)
            return null;
        const relative = path.relative(storagePath, notePath);
        const parts = relative.split(path.sep);
        return parts.length > 0 ? parts[0] : null;
    }
    async _lockVault(password) {
        const notePath = this._currentNotePath;
        if (notePath && notePath.endsWith('.anemona-key') && password) {
            const newPath = await this._notesService.lockNoteFile(notePath, password);
            if (newPath) {
                this._currentNotePath = newPath;
                const noteName = path.basename(newPath);
                const category = this._getCategoryFromNotePath(newPath);
                this._loadNotes(category || '', this._currentFolderPath);
                this._postMessage({
                    command: 'noteContent',
                    note: { name: noteName, filePath: newPath, fileType: 'key' },
                    fileType: 'key',
                    entries: [],
                    locked: true,
                });
            }
            else {
                this._postMessage({ command: 'error', message: 'Failed to lock file' });
            }
        }
        else {
            this._postMessage({ command: 'error', message: 'Password is required to lock this file' });
        }
    }
    _postMessage(message) {
        this._view?.webview.postMessage(message);
    }
    _getHtmlContent(webview) {
        const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist');
        const indexPath = vscode.Uri.joinPath(distPath, 'index.html');
        let html;
        try {
            html = require('fs').readFileSync(indexPath.fsPath, 'utf-8');
        }
        catch {
            return this._getFallbackHtml();
        }
        html = html.replace(/(src|href)="\.\/assets\/([^"]+)"/g, (_match, attr, file) => {
            const uri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'assets', file));
            return `${attr}="${uri}"`;
        });
        const iconCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'style.css'));
        html = html.replace('</head>', `  <link rel="stylesheet" href="${iconCssUri}">
</head>`);
        return html;
    }
    _getFallbackHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Notes</title></head>
<body>
  <p>Building webview... run <code>npm run build:webview</code> first.</p>
</body>
</html>`;
    }
    refresh() {
        this._loadCategories();
        if (this._currentCategory) {
            this._loadNotes(this._currentCategory, this._currentFolderPath);
        }
    }
    postSearchCommand() {
        this._postMessage({ command: 'activateSearch' });
    }
    handleRecentFoldersCommand() {
        const folders = this._getRecentFolders();
        if (folders.length === 0) {
            vscode.window.showInformationMessage('No recent folders found');
            return;
        }
        const picks = folders.map((f) => ({
            label: f.name,
            description: f.path,
            detail: f.icon ? `Icon: ${f.icon}` : undefined,
            path: f.path,
        }));
        vscode.window.showQuickPick(picks, {
            title: 'Recent Folders',
            placeHolder: 'Select a folder to open',
        }).then((selection) => {
            if (selection) {
                this._openRecentFolder(selection.path);
            }
        });
    }
    async handleExportCommand() {
        await this._exportVault();
    }
    async handleImportCommand() {
        await this._importVault();
    }
    _updateViewTitle() {
        if (!this._view)
            return;
        const storageName = this._notesService.getStorageName();
        this._view.title = storageName || 'Notes';
        this._view.description = '';
    }
    async setStoragePath() {
        const selected = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select Notes Folder',
        });
        if (selected && selected.length > 0) {
            const folderPath = selected[0].fsPath;
            await ConfigService_1.ConfigService.setStoragePath(folderPath);
            this._notesService.setStoragePath(folderPath);
            this._addRecentFolder(folderPath);
            this._updateViewTitle();
            this._loadCategories();
        }
    }
    async _exportVault() {
        try {
            const storagePath = this._notesService.getStoragePath();
            if (!storagePath) {
                vscode.window.showErrorMessage('No storage folder configured');
                return;
            }
            const defaultName = `${path.basename(storagePath)}-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(path.join(storagePath, '..', defaultName)),
                filters: { 'Zip Archive': ['zip'] },
            });
            if (!uri)
                return;
            await this._notesService.exportVault(uri.fsPath);
            vscode.window.showInformationMessage(`Vault exported to ${uri.fsPath}`);
            this._postMessage({ command: 'vaultExported' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to export vault',
            });
        }
    }
    async _importVault() {
        try {
            const storagePath = this._notesService.getStoragePath();
            if (!storagePath) {
                vscode.window.showErrorMessage('No storage folder configured');
                return;
            }
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'Zip Archive': ['zip'] },
                openLabel: 'Import Zip Archive',
            });
            if (!uri || uri.length === 0)
                return;
            const zipPath = uri[0].fsPath;
            const entries = await this._notesService.scanZipContents(zipPath);
            const conflicting = entries.filter((e) => {
                const fullPath = path.join(storagePath, e);
                return fs.existsSync(fullPath);
            });
            if (conflicting.length > 0) {
                const preview = conflicting.slice(0, 10).map((e) => `  • ${e}`).join('\n');
                const more = conflicting.length > 10 ? `\n  … and ${conflicting.length - 10} more` : '';
                const message = `"${path.basename(storagePath)}" already contains ${conflicting.length} file(s) from the archive:\n${preview}${more}`;
                const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Overwrite all', 'Skip existing');
                if (!choice)
                    return;
                const mode = choice === 'Overwrite all' ? 'overwrite' : 'skip';
                await this._notesService.importVault(zipPath, mode);
                if (mode === 'skip') {
                    const skipped = conflicting.length;
                    const imported = entries.length - skipped;
                    vscode.window.showInformationMessage(`${imported} file(s) imported (${skipped} skipped — already exist)`);
                }
                else {
                    vscode.window.showInformationMessage(`${entries.length} file(s) imported (overwritten existing)`);
                }
            }
            else {
                await this._notesService.importVault(zipPath, 'overwrite');
                vscode.window.showInformationMessage(`${entries.length} file(s) imported successfully`);
            }
            this._loadCategories();
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to import vault',
            });
        }
    }
}
exports.NotesViewProvider = NotesViewProvider;
NotesViewProvider.viewType = 'anemonaVault.view';
//# sourceMappingURL=NotesViewProvider.js.map