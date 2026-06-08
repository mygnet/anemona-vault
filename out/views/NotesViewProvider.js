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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const ConfigService_1 = require("./../services/ConfigService");
class NotesViewProvider {
    constructor(_extensionUri, notesService) {
        this._extensionUri = _extensionUri;
        this._currentNotePath = null;
        this._notesService = notesService;
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
                this._loadNotes(message.category);
                break;
            case 'selectNote':
                await this._loadNoteContent(message.category, message.note);
                break;
            case 'createNote':
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
        }
    }
    _loadCategories() {
        const storagePath = this._notesService.getStoragePath();
        if (!storagePath) {
            this._updateViewTitle();
            this._postMessage({ command: 'storagePathRequired' });
            return;
        }
        this._updateViewTitle();
        const categories = this._notesService.getCategories();
        this._postMessage({
            command: 'categoriesLoaded',
            categories: categories.map((c) => ({
                name: c.name,
                path: c.path,
                config: c.config,
                canDelete: c.canDelete === true,
            })),
        });
    }
    _loadNotes(categoryName) {
        const notes = this._notesService.getNotesForCategory(categoryName);
        this._postMessage({
            command: 'notesLoaded',
            category: categoryName,
            notes: notes.map((n) => ({
                name: n.name,
                filePath: n.filePath,
                fileType: n.fileType,
                displayName: this._notesService.getDisplayName(n.name),
                icon: this._notesService.getFileIcon(n.name),
            })),
        });
    }
    async _loadNoteContent(categoryName, noteName) {
        try {
            const notes = this._notesService.getNotesForCategory(categoryName);
            const note = notes.find((n) => n.name === noteName);
            if (!note)
                return;
            this._currentNotePath = note.filePath;
            const fileType = note.fileType;
            if (fileType === 'key') {
                if (this._notesService.isLockedFile(note.name)) {
                    this._postMessage({
                        command: 'noteContent',
                        note: { name: note.name, filePath: note.filePath, fileType },
                        fileType: 'key',
                        entries: [],
                        locked: true,
                    });
                }
                else {
                    const { entries, locked } = await this._notesService.readKeyEntries(note.filePath);
                    if (locked) {
                        this._postMessage({
                            command: 'noteContent',
                            note: { name: note.name, filePath: note.filePath, fileType },
                            fileType: 'key',
                            entries: entries,
                            locked: true,
                        });
                    }
                    else {
                        const decrypted = await this._notesService.readDecryptedKeyEntries(note.filePath);
                        this._postMessage({
                            command: 'noteContent',
                            note: { name: note.name, filePath: note.filePath, fileType },
                            fileType: 'key',
                            entries: decrypted,
                            locked: false,
                        });
                    }
                }
            }
            else if (fileType === 'command') {
                const entries = await this._notesService.readCommandEntries(note.filePath);
                this._postMessage({
                    command: 'noteContent',
                    note: { name: note.name, filePath: note.filePath, fileType },
                    fileType: 'command',
                    entries,
                });
            }
            else if (fileType === 'todo') {
                const entries = await this._notesService.readTodoEntries(note.filePath);
                this._postMessage({
                    command: 'noteContent',
                    note: { name: note.name, filePath: note.filePath, fileType },
                    fileType: 'todo',
                    entries,
                });
            }
            else {
                const content = await this._notesService.readNote(note.filePath);
                this._postMessage({
                    command: 'noteContent',
                    note: { name: note.name, filePath: note.filePath, fileType },
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
            const note = await this._notesService.createNote(category, title, fileType);
            this._postMessage({
                command: 'noteCreated',
                note: {
                    name: note.name,
                    filePath: note.filePath,
                    fileType: note.fileType,
                },
            });
            this._loadCategories();
            this._loadNotes(category);
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
                ? 'This folder still has an old `.env-anemona` password format. Create a new empty key file or reset that folder config before saving.'
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
            this._postMessage({ command: 'noteSaved' });
        }
        catch (err) {
            this._postMessage({
                command: 'error',
                message: err instanceof Error ? err.message : 'Failed to save todo entries',
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
                this._loadNotes(category);
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
                this._loadNotes(category);
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
            this._loadNotes(newName);
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
            this._loadNotes(categoryName);
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
                this._loadNotes(category || '');
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
                this._loadNotes(category || '');
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
            this._updateViewTitle();
            this._loadCategories();
        }
    }
}
exports.NotesViewProvider = NotesViewProvider;
NotesViewProvider.viewType = 'anemonaVault.view';
//# sourceMappingURL=NotesViewProvider.js.map