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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const NotesService_1 = require("./services/NotesService");
const NotesViewProvider_1 = require("./views/NotesViewProvider");
let notesService;
let notesViewProvider;
function activate(context) {
    notesService = new NotesService_1.NotesService();
    notesViewProvider = new NotesViewProvider_1.NotesViewProvider(context.extensionUri, notesService, context.globalState);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(NotesViewProvider_1.NotesViewProvider.viewType, notesViewProvider));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.selectStorageFolder', async () => {
        await notesViewProvider.setStoragePath();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.refresh', () => {
        notesViewProvider.refresh();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.moreActions', async () => {
        const selection = await vscode.window.showQuickPick([
            {
                label: '$(history) Recent folders',
                description: 'Reopen a recently used storage folder',
                action: 'recent',
            },
            {
                label: '$(search) Search',
                description: 'Search across all notes',
                action: 'search',
            },
            {
                label: '$(folder-opened) Open folder',
                description: 'Choose notes storage folder',
                action: 'folder',
            },
            {
                label: '$(sync) Reload',
                description: 'Refresh categories and notes',
                action: 'refresh',
            },
            {
                label: '$(cloud-download) Export',
                description: 'Export all notes as zip archive',
                action: 'export',
            },
            {
                label: '$(cloud-upload) Import',
                description: 'Import notes from zip archive',
                action: 'import',
            },
        ], {
            title: 'Notes',
            placeHolder: 'Choose an action',
        });
        if (!selection)
            return;
        if (selection.action === 'recent') {
            notesViewProvider.handleRecentFoldersCommand();
            return;
        }
        if (selection.action === 'search') {
            vscode.commands.executeCommand('anemonaVault.view.focus');
            notesViewProvider.postSearchCommand();
            return;
        }
        if (selection.action === 'folder') {
            await notesViewProvider.setStoragePath();
            return;
        }
        if (selection.action === 'refresh') {
            notesViewProvider.refresh();
            return;
        }
        if (selection.action === 'export') {
            await notesViewProvider.handleExportCommand();
            return;
        }
        if (selection.action === 'import') {
            await notesViewProvider.handleImportCommand();
            return;
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.createNote', () => {
        vscode.commands.executeCommand('anemonaVault.view.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.createCategory', () => {
        vscode.commands.executeCommand('anemonaVault.view.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.deleteNote', () => {
        vscode.commands.executeCommand('anemonaVault.view.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.search', () => {
        vscode.commands.executeCommand('anemonaVault.view.focus');
        notesViewProvider.postSearchCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.exportVault', () => {
        notesViewProvider.handleExportCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.importVault', () => {
        notesViewProvider.handleImportCommand();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('anemonaVault.recentFolders', () => {
        notesViewProvider.handleRecentFoldersCommand();
    }));
}
function deactivate() {
    // cleanup if needed
}
//# sourceMappingURL=extension.js.map