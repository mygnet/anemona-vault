import * as vscode from 'vscode'
import { NotesService } from './services/NotesService'
import { NotesViewProvider } from './views/NotesViewProvider'

let notesService: NotesService
let notesViewProvider: NotesViewProvider

export function activate(context: vscode.ExtensionContext): void {
  notesService = new NotesService()
  notesViewProvider = new NotesViewProvider(context.extensionUri, notesService, context.globalState)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NotesViewProvider.viewType,
      notesViewProvider,
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.selectStorageFolder',
      async () => {
        await notesViewProvider.setStoragePath()
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.refresh',
      () => {
        notesViewProvider.refresh()
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.moreActions',
      async () => {
        const selection = await vscode.window.showQuickPick(
          [
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
          ],
          {
            title: 'Notes',
            placeHolder: 'Choose an action',
          },
        )

        if (!selection) return

        if (selection.action === 'recent') {
          notesViewProvider.handleRecentFoldersCommand()
          return
        }

        if (selection.action === 'search') {
          vscode.commands.executeCommand('anemonaVault.view.focus')
          notesViewProvider.postSearchCommand()
          return
        }

        if (selection.action === 'folder') {
          await notesViewProvider.setStoragePath()
          return
        }

        if (selection.action === 'refresh') {
          notesViewProvider.refresh()
          return
        }

        if (selection.action === 'export') {
          await notesViewProvider.handleExportCommand()
          return
        }

        if (selection.action === 'import') {
          await notesViewProvider.handleImportCommand()
          return
        }
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.createNote',
      () => {
        vscode.commands.executeCommand('anemonaVault.view.focus')
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.createCategory',
      () => {
        vscode.commands.executeCommand('anemonaVault.view.focus')
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.deleteNote',
      () => {
        vscode.commands.executeCommand('anemonaVault.view.focus')
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.search',
      () => {
        vscode.commands.executeCommand('anemonaVault.view.focus')
        notesViewProvider.postSearchCommand()
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.exportVault',
      () => {
        notesViewProvider.handleExportCommand()
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.importVault',
      () => {
        notesViewProvider.handleImportCommand()
      },
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.recentFolders',
      () => {
        notesViewProvider.handleRecentFoldersCommand()
      },
    ),
  )
}

export function deactivate(): void {
  // cleanup if needed
}
