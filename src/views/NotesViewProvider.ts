import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { NotesService } from '../services/NotesService'
import { ConfigService } from './../services/ConfigService'
import type { FileType, WebviewMessage, FolderBrief, FolderTreeNode, RecentFolderData, CategoryConfig } from '../types/notes'

export class NotesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'anemonaVault.view'

  private _view?: vscode.WebviewView
  private _notesService: NotesService
  private _currentNotePath: string | null = null
  private _currentCategory: string | null = null
  private _currentFolderPath: string = ''
  private _globalState: vscode.Memento | null = null

  constructor(
    private readonly _extensionUri: vscode.Uri,
    notesService: NotesService,
    globalState?: vscode.Memento,
  ) {
    this._notesService = notesService
    this._globalState = globalState ?? null
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
        this._currentCategory = message.category as string
        this._currentFolderPath = (message.folderPath as string) || ''
        await this._loadNotes(this._currentCategory, this._currentFolderPath)
        break

      case 'selectNote':
        await this._loadNoteContent(
          message.category as string,
          message.note as string,
        )
        break

      case 'createNote':
        this._currentFolderPath = (message.folderPath as string) || this._currentFolderPath
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

      case 'moveNote':
        await this._moveNote(
          message.notePath as string,
          message.targetCategory as string,
          message.targetFolderPath as string | undefined,
        )
        break

      case 'openFolder':
        this._currentFolderPath = message.folderPath as string
        await this._loadNotes(this._currentCategory || (message.category as string), this._currentFolderPath)
        break

      case 'createFolder':
        await this._createFolder(message.parentPath as string, message.name as string)
        break

      case 'deleteFolder':
        await this._deleteFolder(message.folderPath as string)
        break

      case 'renameFolder':
        await this._renameFolder(message.folderPath as string, message.name as string)
        break

      case 'moveFolder':
        await this._moveFolder(message.sourcePath as string, message.targetDir as string)
        break

      case 'dropItem':
        await this._handleDropItem(message.sourcePath as string, message.targetPath as string)
        break

      case 'updateFolderColor':
        await this._updateFolderColor(message.folderPath as string, message.color as string)
        break

      case 'getFolderTree':
        await this._sendFolderTree(message.categoryName as string)
        break

      case 'checkSelection':
        this._handleCheckSelection(Number(message.requestId || 0))
        break

      case 'openExternal':
        this._handleOpenExternal(message as unknown as { type: string; value: string })
        break

      case 'insertIntoEditor':
        this._handleInsertIntoEditor(message.text as string)
        break

      case 'importContent':
        await this._handleImportContent(message.notePath as string)
        break

      case 'exportNote':
        await this._exportNote(
          message.notePath as string,
          message.format as string,
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

      case 'saveSnippetEntries':
        await this._saveSnippetEntries(
          message.notePath as string,
          message.entries as any[],
        )
        break

      case 'searchGlobal':
        await this._searchGlobal(String(message.query || ''))
        break

      case 'openRecentFolder':
        await this._openRecentFolder(message.folderPath as string)
        break

      case 'getRecentFolders':
        await this._sendRecentFolders()
        break
    }
  }

  private _loadCategories(): void {
    const storagePath = this._notesService.getStoragePath()
    if (!storagePath) {
      this._updateViewTitle()
      this._postMessage({
        command: 'storagePathRequired',
        recentFolders: this._getRecentFolders(),
      })
      return
    }

    this._updateViewTitle()
    const categories = this._notesService.getCategories()
    const rootCategoryConfig = this._notesService.readRootCategoryConfig()
    this._postMessage({
      command: 'categoriesLoaded',
      categories: categories.map((c) => ({
        name: c.name,
        path: c.path,
        config: rootCategoryConfig ? { ...rootCategoryConfig, ...c.config } : c.config,
        canDelete: c.canDelete === true,
      })),
    })
  }

  private _getRecentFolders(): RecentFolderData[] {
    if (!this._globalState) return []
    const stored = this._globalState.get<RecentFolderData[]>('recentFolders', [])
    return stored
      .filter((f) => fs.existsSync(f.path))
      .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
      .slice(0, 8)
  }

  private _addRecentFolder(folderPath: string): void {
    if (!this._globalState) return

    const stored = this._globalState.get<RecentFolderData[]>('recentFolders', [])
    const name = path.basename(path.normalize(folderPath))

    let icon: string | undefined

    const rootConfigPath = path.join(folderPath, '.config.json')
    if (fs.existsSync(rootConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(rootConfigPath, 'utf-8')) as CategoryConfig
        icon = config.icon
      } catch {
        // ignore invalid config
      }
    }

    const entry: RecentFolderData = {
      path: folderPath,
      name,
      icon,
      lastOpened: new Date().toISOString(),
    }

    const filtered = stored.filter((f) => f.path !== folderPath)
    filtered.unshift(entry)
    this._globalState.update('recentFolders', filtered.slice(0, 16))
  }

  private _removeRecentFolder(folderPath: string): void {
    if (!this._globalState) return
    const stored = this._globalState.get<RecentFolderData[]>('recentFolders', [])
    this._globalState.update(
      'recentFolders',
      stored.filter((f) => f.path !== folderPath),
    )
  }

  private async _openRecentFolder(folderPath: string): Promise<void> {
    if (!fs.existsSync(folderPath)) {
      this._removeRecentFolder(folderPath)
      this._postMessage({
        command: 'error',
        message: `Folder "${folderPath}" no longer exists`,
      })
      this._loadCategories()
      return
    }

    await ConfigService.setStoragePath(folderPath)
    this._notesService.setStoragePath(folderPath)
    this._addRecentFolder(folderPath)
    this._updateViewTitle()
    this._loadCategories()
  }

  private async _sendRecentFolders(): Promise<void> {
    this._postMessage({
      command: 'recentFolders',
      recentFolders: this._getRecentFolders(),
    })
  }

  private async _loadNotes(categoryName: string, folderPath?: string): Promise<void> {
    const contents = this._notesService.getFolderContents(categoryName, folderPath)
    const effectiveConfig = this._notesService.getMergedConfig(categoryName, folderPath)
    const fileCache = effectiveConfig?.file ?? {}

    const relativeFolderPath = folderPath || ''
    const parentFolder = relativeFolderPath
      ? relativeFolderPath.split('/').slice(0, -1).join('/')
      : null

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
    })
  }

  private async _loadNoteContent(
    categoryName: string,
    noteName: string,
  ): Promise<void> {
    try {
      const categoryPath = path.join(this._notesService.getStoragePath() || '', categoryName)
      const allNotes = this._notesService.getNotesRecursive(categoryPath)
      const note = allNotes.find((n) => n.name === noteName)

      if (!note) return

      this._currentNotePath = note.filePath
      const fileType = note.fileType
      const noteRelativeFolder = path.relative(categoryPath, path.dirname(note.filePath))
      const effectiveConfig = this._notesService.getMergedConfig(categoryName, noteRelativeFolder || undefined)

      const postNoteContent = (extra: Record<string, unknown> = {}) => {
        this._postMessage({
          command: 'noteContent',
          note: { name: note.name, filePath: note.filePath, fileType },
          effectiveConfig,
          ...extra,
        })
      }

      if (fileType === 'key') {
        if (this._notesService.isLockedFile(note.name)) {
          postNoteContent({
            fileType: 'key',
            entries: [],
            locked: true,
          })
        } else {
          const { entries, locked } = await this._notesService.readKeyEntries(note.filePath)

          if (locked) {
            postNoteContent({
              fileType: 'key',
              entries: entries,
              locked: true,
            })
          } else {
            const decrypted = await this._notesService.readDecryptedKeyEntries(note.filePath)
            postNoteContent({
              fileType: 'key',
              entries: decrypted,
              locked: false,
            })
          }
        }
      } else if (fileType === 'command') {
        const entries = await this._notesService.readCommandEntries(note.filePath)
        postNoteContent({
          fileType: 'command',
          entries,
        })
      } else if (fileType === 'todo') {
        const entries = await this._notesService.readTodoEntries(note.filePath)
        postNoteContent({
          fileType: 'todo',
          entries,
        })
      } else if (fileType === 'snippet') {
        const entries = await this._notesService.readSnippetEntries(note.filePath)
        postNoteContent({
          fileType: 'snippet',
          entries,
        })
      } else {
        const content = await this._notesService.readNote(note.filePath)
        postNoteContent({
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
      const parentFolderPath = this._currentFolderPath
        ? path.join(this._notesService.getStoragePath() || '', category, this._currentFolderPath)
        : undefined
      const note = await this._notesService.createNote(category, title, fileType, parentFolderPath)
      this._postMessage({
        command: 'noteCreated',
        note: {
          name: note.name,
          filePath: note.filePath,
          fileType: note.fileType,
        },
      })
      this._loadCategories()
      this._loadNotes(this._currentCategory || category, this._currentFolderPath)
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
          ? 'This folder still has a password-protected `.config.json`. Copy that file with the folder or reset the folder config before saving.'
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
      const activeEntries = (entries as any[]).filter(
        (e: any) => e.status !== 'cancelled',
      )
      const progress = activeEntries.length === 0
        ? 0
        : Math.round(
            activeEntries.reduce(
              (sum: number, e: any) =>
                sum + Math.max(0, Math.min(100, Number(e.progress) || 0)),
              0,
            ) / activeEntries.length,
          )
      const folderPath = path.dirname(notePath)
      const fileName = path.basename(notePath)
      await this._notesService.updateCategoryFileProgress(folderPath, fileName, progress)
      this._postMessage({ command: 'noteSaved' })
      const actualCategory = this._getCategoryFromNotePath(notePath) || this._currentCategory || ''
      this._loadNotes(actualCategory, this._currentFolderPath)
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to save todo entries',
      })
    }
  }

  private async _saveSnippetEntries(
    notePath: string,
    entries: any[],
  ): Promise<void> {
    try {
      await this._notesService.saveSnippetEntries(notePath, entries)
      this._postMessage({ command: 'noteSaved' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to save snippet entries',
      })
    }
  }

  private async _searchGlobal(query: string): Promise<void> {
    try {
      const results = await this._notesService.searchAll(query)
      this._postMessage({
        command: 'globalSearchResults',
        query,
        results,
      })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to search vault',
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
        this._loadNotes(category, this._currentFolderPath)
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
        this._loadNotes(category, this._currentFolderPath)
      }
      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to rename note',
      })
    }
  }

  private async _moveNote(notePath: string, targetCategory: string, targetFolderPath?: string): Promise<void> {
    try {
      const sourceCategory = this._getCategoryFromNotePath(notePath)
      if (targetFolderPath) {
        const rootPath = this._notesService.getStoragePath()
        const storagePath = rootPath || ''
        const targetDir = path.join(storagePath, targetCategory, targetFolderPath)
        await this._notesService.moveItem(notePath, targetDir)
      } else {
        await this._notesService.moveNote(notePath, targetCategory)
      }
      this._postMessage({ command: 'noteMoved', notePath, targetCategory })
      if (sourceCategory) {
        this._loadNotes(sourceCategory, this._currentFolderPath)
      }
      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to move note',
      })
    }
  }

  private async _createFolder(parentPath: string, name: string): Promise<void> {
    try {
      await this._notesService.createFolder(parentPath, name)
      const category = this._getCategoryFromNotePath(parentPath) || this._currentCategory
      if (category) {
        this._loadNotes(category, this._currentFolderPath)
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to create folder',
      })
    }
  }

  private async _deleteFolder(folderPath: string): Promise<void> {
    try {
      await this._notesService.deleteFolder(folderPath)
      const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory
      if (category) {
        this._loadNotes(category, this._currentFolderPath)
      }
      this._loadCategories()
      this._postMessage({ command: 'folderDeleted' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete folder',
      })
    }
  }

  private async _renameFolder(folderPath: string, name: string): Promise<void> {
    try {
      await this._notesService.renameFolder(folderPath, name)
      const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory
      if (category) {
        this._loadNotes(category, this._currentFolderPath)
      }
      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to rename folder',
      })
    }
  }

  private async _moveFolder(sourcePath: string, targetDir: string): Promise<void> {
    try {
      await this._notesService.moveItem(sourcePath, targetDir)
      const sourceCategory = this._getCategoryFromNotePath(sourcePath) || this._currentCategory
      this._postMessage({ command: 'folderMoved', sourcePath, targetDir })
      if (sourceCategory) {
        this._loadNotes(sourceCategory, this._currentFolderPath)
        this._loadCategories()
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to move item',
      })
    }
  }

  private async _handleDropItem(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await this._notesService.moveItem(sourcePath, targetPath)
      const sourceCategory = this._getCategoryFromNotePath(sourcePath) || this._currentCategory
      this._postMessage({ command: 'itemMoved', sourcePath, targetPath })
      if (sourceCategory) {
        this._loadNotes(sourceCategory, this._currentFolderPath)
        this._loadCategories()
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to move item',
      })
    }
  }

  private async _updateFolderColor(folderPath: string, color: string): Promise<void> {
    try {
      await this._notesService.updateFolderColor(folderPath, color)
      const category = this._getCategoryFromNotePath(folderPath) || this._currentCategory
      if (category) {
        this._loadNotes(category, this._currentFolderPath)
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to update folder color',
      })
    }
  }

  private _handleCheckSelection(requestId = 0): void {
    try {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        this._postMessage({ command: 'selectionAnalysis', requestId, suggestion: null })
        return
      }

      const text = editor.document.getText(editor.selection)
      const suggestion = this._notesService.analyzeSelection(text)

      this._postMessage({
        command: 'selectionAnalysis',
        requestId,
        suggestion: suggestion ? { title: suggestion.title, type: suggestion.type, text } : null,
      })
    } catch {
      this._postMessage({ command: 'selectionAnalysis', requestId, suggestion: null })
    }
  }

  private async _sendFolderTree(categoryName: string): Promise<void> {
    try {
      const rootPath = this._notesService.getStoragePath()
      if (!rootPath) return
      const categoryPath = path.join(rootPath, categoryName)
      const tree = this._notesService.getFolderTree(categoryPath)
      this._postMessage({
        command: 'folderTree',
        categoryName,
        tree,
      })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to get folder tree',
      })
    }
  }

  private async _handleImportContent(notePath: string): Promise<void> {
    try {
      let content = ''
      let sourceFilePath: string | undefined

      const editor = vscode.window.activeTextEditor
      if (editor && !editor.selection.isEmpty) {
        content = editor.document.getText(editor.selection)
      } else {
        const files = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          openLabel: 'Import file',
          filters: {
            'All Files': ['*'],
            'Anemona Vault': ['*anemona-key', '*anemona-lock', '*anemona-command', '*anemona-todo', '*anemona-snippet', '*.md'],
          },
        })
        if (!files || files.length === 0) return
        sourceFilePath = files[0].fsPath

        const fileType = this._notesService.getFileType(path.basename(sourceFilePath))

        if (sourceFilePath.endsWith('.anemona-lock')) {
          const password = await vscode.window.showInputBox({
            prompt: 'Enter password to decrypt the key file',
            password: true,
            placeHolder: 'Password',
          })
          if (!password) return
          const decrypted = await this._notesService.decryptFileContent(sourceFilePath, password)
          if (decrypted === null) {
            vscode.window.showErrorMessage('Incorrect password or corrupted file')
            return
          }
          content = decrypted
        } else if (fileType === 'key') {
          const raw = fs.readFileSync(sourceFilePath, 'utf-8')
          const parsed = JSON.parse(raw)
          const entries = Array.isArray(parsed) ? parsed : (parsed.entries || [])
          if (entries.length > 0 && typeof entries[0].password === 'string' && entries[0].password.length > 40) {
            const sourceVaultPath = this._findVaultRoot(sourceFilePath)
            let vaultPassword: string | undefined
            if (sourceVaultPath) {
              const configPath = path.join(sourceVaultPath, '.config.json')
              if (fs.existsSync(configPath)) {
                try {
                  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
                  if (cfg.vault?.mode === 'password') {
                    vaultPassword = await vscode.window.showInputBox({
                      prompt: 'Enter the source vault password to decrypt key entries',
                      password: true,
                      placeHolder: 'Source vault password',
                    }) || undefined
                    if (!vaultPassword) {
                      vaultPassword = undefined
                    }
                  }
                } catch { /* use undefined password */ }
              }
            }
            const decrypted = await this._notesService.tryDecryptKeyEntries(entries, sourceVaultPath || path.dirname(sourceFilePath), vaultPassword)
            if (decrypted) {
              content = JSON.stringify(decrypted, null, 2)
            } else {
              vscode.window.showWarningMessage('Could not decrypt entries. Importing as-is (passwords may remain encrypted).')
              content = raw
            }
          } else {
            content = raw
          }
        } else {
          content = fs.readFileSync(sourceFilePath, 'utf-8')
        }
      }

      await this._notesService.importContent(content, notePath)

      const category = this._getCategoryFromNotePath(notePath) || this._currentCategory
      this._postMessage({ command: 'contentImported', notePath })
      if (category) {
        this._loadNotes(category, this._currentFolderPath)
        this._loadCategories()
      }
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to import content',
      })
    }
  }

  private _findVaultRoot(filePath: string): string | null {
    let dir = path.dirname(filePath)
    const root = path.parse(dir).root
    while (dir !== root) {
      if (fs.existsSync(path.join(dir, '.config.json'))) return dir
      dir = path.dirname(dir)
    }
    return null
  }

  private async _exportNote(notePath: string, format: string): Promise<void> {
    try {
      const { content, language } = await this._notesService.exportNote(notePath, format)
      const doc = await vscode.workspace.openTextDocument({
        content,
        language,
      })
      await vscode.window.showTextDocument(doc, { preview: true })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to export note',
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
      this._loadNotes(newName, this._currentFolderPath)
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
      this._loadNotes(categoryName, this._currentFolderPath)
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
        this._loadNotes(category || '', this._currentFolderPath)
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
        this._loadNotes(category || '', this._currentFolderPath)
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
    if (this._currentCategory) {
      this._loadNotes(this._currentCategory, this._currentFolderPath)
    }
  }

  postSearchCommand(): void {
    this._postMessage({ command: 'activateSearch' })
  }

  handleRecentFoldersCommand(): void {
    const folders = this._getRecentFolders()
    if (folders.length === 0) {
      vscode.window.showInformationMessage('No recent folders found')
      return
    }

    const picks = folders.map((f) => ({
      label: f.name,
      description: f.path,
      detail: f.icon ? `Icon: ${f.icon}` : undefined,
      path: f.path,
    }))

    vscode.window.showQuickPick(picks, {
      title: 'Recent Folders',
      placeHolder: 'Select a folder to open',
    }).then((selection) => {
      if (selection) {
        this._openRecentFolder(selection.path)
      }
    })
  }

  async handleExportCommand(): Promise<void> {
    await this._exportVault()
  }

  async handleImportCommand(): Promise<void> {
    await this._importVault()
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
      this._addRecentFolder(folderPath)
      this._updateViewTitle()
      this._loadCategories()
    }
  }

  private async _exportVault(): Promise<void> {
    try {
      const storagePath = this._notesService.getStoragePath()
      if (!storagePath) {
        vscode.window.showErrorMessage('No storage folder configured')
        return
      }

      const defaultName = `${path.basename(storagePath)}-backup-${new Date().toISOString().slice(0, 10)}.zip`
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(storagePath, '..', defaultName)),
        filters: { 'Zip Archive': ['zip'] },
      })

      if (!uri) return

      await this._notesService.exportVault(uri.fsPath)
      vscode.window.showInformationMessage(`Vault exported to ${uri.fsPath}`)
      this._postMessage({ command: 'vaultExported' })
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to export vault',
      })
    }
  }

  private async _importVault(): Promise<void> {
    try {
      const storagePath = this._notesService.getStoragePath()
      if (!storagePath) {
        vscode.window.showErrorMessage('No storage folder configured')
        return
      }

      const uri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'Zip Archive': ['zip'] },
        openLabel: 'Import Zip Archive',
      })

      if (!uri || uri.length === 0) return

      const zipPath = uri[0].fsPath
      const entries = await this._notesService.scanZipContents(zipPath)

      const conflicting = entries.filter((e) => {
        const fullPath = path.join(storagePath, e)
        return fs.existsSync(fullPath)
      })

      if (conflicting.length > 0) {
        const preview = conflicting.slice(0, 10).map((e) => `  • ${e}`).join('\n')
        const more = conflicting.length > 10 ? `\n  … and ${conflicting.length - 10} more` : ''
        const message = `"${path.basename(storagePath)}" already contains ${conflicting.length} file(s) from the archive:\n${preview}${more}`

        const choice = await vscode.window.showWarningMessage(
          message,
          { modal: true },
          'Overwrite all',
          'Skip existing',
        )

        if (!choice) return

        const mode = choice === 'Overwrite all' ? 'overwrite' : 'skip'
        await this._notesService.importVault(zipPath, mode)

        if (mode === 'skip') {
          const skipped = conflicting.length
          const imported = entries.length - skipped
          vscode.window.showInformationMessage(
            `${imported} file(s) imported (${skipped} skipped — already exist)`
          )
        } else {
          vscode.window.showInformationMessage(
            `${entries.length} file(s) imported (overwritten existing)`
          )
        }
      } else {
        await this._notesService.importVault(zipPath, 'overwrite')
        vscode.window.showInformationMessage(
          `${entries.length} file(s) imported successfully`
        )
      }

      this._loadCategories()
    } catch (err) {
      this._postMessage({
        command: 'error',
        message: err instanceof Error ? err.message : 'Failed to import vault',
      })
    }
  }

  private _handleOpenExternal(message: { type: string; value: string }): void {
    try {
      let uri: vscode.Uri
      if (message.type === 'email') {
        uri = vscode.Uri.parse(`mailto:${message.value}`)
      } else if (message.type === 'host') {
        const host = message.value.replace(/^https?:\/\//, '')
        uri = vscode.Uri.parse(`https://${host}`)
      } else {
        const url = message.value.startsWith('http') ? message.value : `https://${message.value}`
        uri = vscode.Uri.parse(url)
      }
      vscode.env.openExternal(uri)
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to open ${message.type}: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  private _handleInsertIntoEditor(text: string): void {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showInformationMessage('No active editor to insert into')
      return
    }
    editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, text)
    })
  }
}
