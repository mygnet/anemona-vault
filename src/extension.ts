import * as vscode from 'vscode'
import { NotesService } from './services/NotesService'
import { NotesViewProvider } from './views/NotesViewProvider'

let notesService: NotesService
let notesViewProvider: NotesViewProvider

export function activate(context: vscode.ExtensionContext): void {
  notesService = new NotesService()
  notesViewProvider = new NotesViewProvider(context.extensionUri, notesService)

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
              label: 'Open folder',
              description: 'Choose notes storage folder',
              action: 'folder',
            },
            {
              label: 'Reload',
              description: 'Refresh categories and notes',
              action: 'refresh',
            },
          ],
          {
            title: 'Notes',
            placeHolder: 'Choose an action',
          },
        )

        if (!selection) return

        if (selection.action === 'folder') {
          await notesViewProvider.setStoragePath()
          return
        }

        if (selection.action === 'refresh') {
          notesViewProvider.refresh()
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
}

export function deactivate(): void {
  // cleanup if needed
}
