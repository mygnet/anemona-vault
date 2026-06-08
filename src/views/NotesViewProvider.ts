import * as path from 'path'
import * as vscode from 'vscode'
import { NotesService } from '../services/NotesService'
import { ConfigService } from './../services/ConfigService'
import type { FileType, WebviewMessage } from '../types/notes'

export class NotesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'anemonaVault.view'

  private _view?: vscode.WebviewView
  private _notesService: NotesService
  private _currentNotePath: string | null = null

  constructor(
    private readonly _extensionUri: vscode.Uri,
    notesService: NotesService,
  ) {
    this._notesService = notesService
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview', 'dist'),
        vscode.Uri.joinPath(this._extensionUri, 'media', 'icons'),
      ],
    }

    webviewView.webview.html = this._getHtmlContent(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this._handleMessage(message)
      },
    )
  }

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'ready':
        this._loadCategories()
        break

      case 'selectCategory':
        this._loadNotes(message.category as string)
        break

      case 'selectNote':
        await this._loadNoteContent(
          message.category as string,
          message.note as string,
        )
        break

      case 'createNote':
        await this._createNote(
          message.category as string,
          message.title as string,
          (message.fileType as FileType) || 'md',
        )
        break

      case 'saveNote':
        await this._saveNote(
          message.notePath as string,
          message.content as string,
        )
        break

      case 'deleteNote':
        await this._deleteNote(message.notePath as string)
        break

      case 'renameNote':
        await this._renameNote(
          message.notePath as string,
          message.title as string,
        )
        break

      case 'createCategory':
        await this._createCategory(message.name as string)
        break

      case 'deleteCategory':
        await this._deleteCategory(message.category as string)
        break

      case 'renameCategory':
        await this._renameCategory(
          message.category as string,
          message.name as string,
        )
        break

      case 'updateCategoryColor':
        await this._updateCategoryColor(
          message.category as string,
          message.color as string,
        )
        break

      case 'selectStorageFolder':
        await this.setStoragePath()
        break

      case 'refresh':
        this._loadCategories()
        break

      case 'unlockVault':
        await this._unlockVault(message.password as string)
        break

      case 'lockVault':
        await this._lockVault(message.password as string)
        break

      case 'saveKeyEntries':
        await this._saveKeyEntries(
          message.notePath as string,
          message.entries as any[],
          message.locked as boolean,
        )
        break

      case 'saveCommandEntries':
        await this._saveCommandEntries(
          message.notePath as string,
          message.entries as any[],
        )
        break

      case 'saveTodoEntries':
        await this._saveTodoEntries(
          message.notePath as string,
          message.entries as any[],
        )
        break
    }
  }

  private _loadCategories(): void {
    const storagePath = this._notesService.getStoragePath()
    if (!storagePath) {
      this._updateViewTitle()
      this._postMessage({ command: 'storagePathRequired' })
      return
    }

    this._updateViewTitle()
    const categories = this._notesService.getCategories()
    this._postMessage({
      command: 'categoriesLoaded',
      categories: categories.map((c) => ({
        name: c.name,
        path: c.path,
        config: c.config,
        canDelete: c.canDelete === true,
      })),
    })
  }

  private _loadNotes(categoryName: string): void {
    const notes = this._notesService.getNotesForCategory(categoryName)
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
    })
  }

  private async _loadNoteContent(
    categoryName: string,
    noteName: string,
  ): Promise<void> {
    try {
      const notes = this._notesService.getNotesForCategory(categoryName)
      const note = notes.find((n) => n.name === noteName)

      if (!note) return

      this._currentNotePath = note.filePath
      const fileType = note.fileType

      if (fileType === 'key') {
        if (this._notesService.isLockedFile(note.name)) {
          this._postMessage({
            command: 'noteContent',
            note: { name: note.name, filePath: note.filePath, fileType },
            fileType: 'key',
            entries: [],
            locked: true,
          })
        } else {
          const { entries, locked } = await this._notesService.readKeyEntries(note.filePath)

          if (locked) {
            this._postMessage({
              command: 'noteContent',
              note: { name: note.name, filePath: note.filePath, fileType },
              fileType: 'key',
              entries: entries,
              locked: true,
            })
          } else {
            const decrypted = await this._notesService.readDecryptedKeyEntries(note.filePath)
            this._postMessage({
              command: 'noteContent',
              note: { name: note.name, filePath: note.filePath, fileType },
              fileType: 'key',
              entries: decrypted,
              locked: false,
            })
          }
        }
      } else if (fileType === 'command') {
        const entries = await this._notesService.readCommandEntries(note.filePath)
        this._postMessage({
          command: 'noteContent',
          note: { name: note.name, filePath: note.filePath, fileType },
          fileType: 'command',
          entries,
        })
      } else if (fileType === 'todo') {
        const entries = await this._notesService.readTodoEntries(note.filePath)
        this._postMessage({
          command: 'noteContent',
          note: { name: note.name, filePath: note.filePath, fileType },
          fileType: 'todo',
          entries,
        })
      } else {
        const content = await this._notesService.readNote(note.filePath)
        this._postMessage({
          command: 'noteContent',
          note: { name: note.name, filePath: note.filePath, fileType },
          fileType: 'md',
          content,
        })
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to read note',
      })
    }
  }

  private async _createNote(
    category: string,
    title: string,
    fileType: FileType,
  ): Promise<void> {
    try {
      const note = await this._notesService.createNote(category, title, fileType)
      this._postMessage({
        command: 'noteCreated',
        note: {
          name: note.name,
          filePath: note.filePath,
          fileType: note.fileType,
        },
      })
      this._loadCategories()
      this._loadNotes(category)
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to create note',
      })
    }
  }

  private async _saveNote(notePath: string, content: string): Promise<void> {
    try {
      await this._notesService.saveNote(notePath, content)
      this._postMessage({ command: 'noteSaved' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to save note',
      })
    }
  }

  private async _saveKeyEntries(
    notePath: string,
    entries: any[],
    locked: boolean,
  ): Promise<void> {
    try {
      await this._notesService.saveKeyEntries(notePath, entries, locked)
      this._postMessage({ command: 'noteSaved' })
    } catch (err) {
      const message =
        err instanceof Error &&
          err.message === 'Vault is locked. Enter your password to unlock.'
          ? 'This folder still has an old `.env-anemona` password format. Create a new empty key file or reset that folder config before saving.'
          : err instanceof Error
            ? err.message
            : 'Failed to save entries'

      this._postMessage({
        command: 'error',
        message,
      })
    }
  }

  private async _saveCommandEntries(
    notePath: string,
    entries: any[],
  ): Promise<void> {
    try {
      await this._notesService.saveCommandEntries(notePath, entries)
      this._postMessage({ command: 'noteSaved' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to save entries',
      })
    }
  }

  private async _saveTodoEntries(
    notePath: string,
    entries: any[],
  ): Promise<void> {
    try {
      await this._notesService.saveTodoEntries(notePath, entries)
      this._postMessage({ command: 'noteSaved' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to save todo entries',
      })
    }
  }

  private async _deleteNote(notePath: string): Promise<void> {
    try {
      await this._notesService.deleteNote(notePath)
      if (this._currentNotePath === notePath) {
        this._currentNotePath = null
      }
      const category = this._getCategoryFromNotePath(notePath)
      if (category) {
        this._loadNotes(category)
      }
      this._loadCategories()
      this._postMessage({ command: 'noteDeleted' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete note',
      })
    }
  }

  private async _renameNote(notePath: string, title: string): Promise<void> {
    try {
      const newPath = await this._notesService.renameNote(notePath, title)
      const category = this._getCategoryFromNotePath(newPath)

      if (this._currentNotePath === notePath) {
        this._currentNotePath = newPath
      }

      this._postMessage({ command: 'noteRenamed', notePath, newPath })
      if (category) {
        this._loadNotes(category)
      }
      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to rename note',
      })
    }
  }

  private async _createCategory(name: string): Promise<void> {
    try {
      await this._notesService.createCategory(name)
      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to create category',
      })
    }
  }

  private async _deleteCategory(categoryName: string): Promise<void> {
    try {
      await this._notesService.deleteCategory(categoryName)
      this._currentNotePath = null
      this._loadCategories()
      this._postMessage({ command: 'categoryDeleted', category: categoryName })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to delete category',
      })
    }
  }

  private async _renameCategory(
    categoryName: string,
    name: string,
  ): Promise<void> {
    try {
      const newName = await this._notesService.renameCategory(categoryName, name)
      this._currentNotePath = null
      this._postMessage({ command: 'categoryRenamed', category: categoryName, newName })
      this._loadCategories()
      this._loadNotes(newName)
    } catch (err) {
      this._postMessage({
        command: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to rename category',
      })
    }
  }

  private async _updateCategoryColor(
    categoryName: string,
    color: string,
  ): Promise<void> {
    try {
      await this._notesService.updateCategoryColor(categoryName, color)
      this._loadCategories()
      this._loadNotes(categoryName)
    } catch (err) {
      this._postMessage({
        command: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to update category color',
      })
    }
  }

  private async _unlockVault(password: string): Promise<void> {
    const notePath = this._currentNotePath

    if (notePath && notePath.endsWith('.anemona-lock')) {
      const newPath = await this._notesService.unlockNoteFile(notePath, password)
      if (newPath) {
        this._currentNotePath = newPath
        const noteName = path.basename(newPath)
        const category = this._getCategoryFromNotePath(newPath)
        this._loadNotes(category || '')
        await this._loadNoteContent(category || '', noteName)
      } else {
        this._postMessage({ command: 'error', message: 'Incorrect password' })
      }
    } else {
      this._postMessage({ command: 'error', message: 'No locked file selected' })
    }
  }

  private _getCategoryFromNotePath(notePath: string): string | null {
    const storagePath = this._notesService.getStoragePath()
    if (!storagePath) return null
    const relative = path.relative(storagePath, notePath)
    const parts = relative.split(path.sep)
    return parts.length > 0 ? parts[0] : null
  }

  private async _lockVault(password?: string): Promise<void> {
    const notePath = this._currentNotePath

    if (notePath && notePath.endsWith('.anemona-key') && password) {
      const newPath = await this._notesService.lockNoteFile(notePath, password)
      if (newPath) {
        this._currentNotePath = newPath
        const noteName = path.basename(newPath)
        const category = this._getCategoryFromNotePath(newPath)
        this._loadNotes(category || '')
        this._postMessage({
          command: 'noteContent',
          note: { name: noteName, filePath: newPath, fileType: 'key' },
          fileType: 'key',
          entries: [],
          locked: true,
        })
      } else {
        this._postMessage({ command: 'error', message: 'Failed to lock file' })
      }
    } else {
      this._postMessage({ command: 'error', message: 'Password is required to lock this file' })
    }
  }

  private _postMessage(message: WebviewMessage): void {
    this._view?.webview.postMessage(message)
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(
      this._extensionUri,
      'webview',
      'dist',
    )
    const indexPath = vscode.Uri.joinPath(distPath, 'index.html')

    let html: string
    try {
      html = require('fs').readFileSync(indexPath.fsPath, 'utf-8')
    } catch {
      return this._getFallbackHtml()
    }

    html = html.replace(
      /(src|href)="\.\/assets\/([^"]+)"/g,
      (_match: string, attr: string, file: string) => {
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, 'assets', file),
        )
        return `${attr}="${uri}"`
      },
    )

    const iconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'icons', 'style.css'),
    )

    html = html.replace(
      '</head>',
      `  <link rel="stylesheet" href="${iconCssUri}">
</head>`,
    )

    return html
  }

  private _getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Notes</title></head>
<body>
  <p>Building webview... run <code>npm run build:webview</code> first.</p>
</body>
</html>`
  }

  refresh(): void {
    this._loadCategories()
  }

  private _updateViewTitle(): void {
    if (!this._view) return

    const storageName = this._notesService.getStorageName()
    this._view.title = storageName || 'Notes'
    this._view.description = ''
  }

  async setStoragePath(): Promise<void> {
    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Notes Folder',
    })

    if (selected && selected.length > 0) {
      const folderPath = selected[0].fsPath
      await ConfigService.setStoragePath(folderPath)
      this._notesService.setStoragePath(folderPath)
      this._updateViewTitle()
      this._loadCategories()
    }
  }
}
