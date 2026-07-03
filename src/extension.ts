import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { NotesService } from './services/NotesService'
import { NotesViewProvider } from './views/NotesViewProvider'
import { NotificationRepository } from './modules/notifications/NotificationRepository'
import { NotificationService } from './modules/notifications/NotificationService'
import { NotificationScheduler } from './modules/notifications/NotificationScheduler'
import { ScheduledEventsCache } from './modules/notifications/ScheduledEventsCache'

let notesService: NotesService
let notesViewProvider: NotesViewProvider

let notifScheduler: NotificationScheduler | null = null
let notifWatchers: vscode.Disposable[] = []

function computeNextDue(dueAt: string, unit: string, value: number): string | null {
  const date = new Date(dueAt)
  if (isNaN(date.getTime())) return null
  const originalDay = date.getDate()
  switch (unit) {
    case 'minute': date.setMinutes(date.getMinutes() + value); break
    case 'hour': date.setHours(date.getHours() + value); break
    case 'day': date.setDate(date.getDate() + value); break
    case 'week': date.setDate(date.getDate() + value * 7); break
    case 'month':
      date.setMonth(date.getMonth() + value)
      if (date.getDate() !== originalDay) date.setDate(0)
      break
    case 'year':
      date.setFullYear(date.getFullYear() + value)
      if (date.getDate() !== originalDay) date.setDate(0)
      break
    default: return null
  }
  return date.toISOString()
}

function disposeNotifications(): void {
  notifScheduler?.stop()
  notifScheduler = null
  for (const w of notifWatchers) {
    try { w.dispose() } catch { /* ignore */ }
  }
  notifWatchers = []
}

function setupNotificationsForVault(vaultPath: string, context: vscode.ExtensionContext): void {
  const cache = new ScheduledEventsCache(vaultPath)
  cache.loadOrCreate()
  notesViewProvider.setScheduledEventsCache(cache)

  const repo = new NotificationRepository(vaultPath)
  const service = new NotificationService(repo)
  notesViewProvider.setNotificationService(service)

  const cfg = vscode.workspace.getConfiguration('anemona-vault')
  const enabled = cfg.get<boolean>('notifications.enabled', true)

  if (enabled) {
    const checkIntervalMinutes = cfg.get<number>('notifications.checkIntervalMinutes', 15)
    const dueSoonHours = cfg.get<number>('notifications.dueSoonHours', 24)
    const tickIntervalSeconds = cfg.get<number>('notifications.tickIntervalSeconds', 5)

    notifScheduler = new NotificationScheduler(cache, service, {
      checkIntervalMinutes,
      dueSoonHours,
      tickIntervalSeconds,
    }, () => {
      notesViewProvider.updateBadge(service.getPendingCount())
    }, (sourceFile, sourceId, currentDueAt, interval) => {
      const vaultPath = notesService.getStoragePath()
      if (!vaultPath) return
      const absPath = path.join(vaultPath, sourceFile)
      if (!fs.existsSync(absPath)) return
      try {
        const raw = fs.readFileSync(absPath, 'utf-8')
        const entries = JSON.parse(raw)
        if (!Array.isArray(entries)) return
        const idx = entries.findIndex((e: any) => String(e.id) === sourceId)
        if (idx === -1) return
        const entry = entries[idx]
        if (!entry.interval) return
        const nextDue = computeNextDue(entry.dueAt, entry.interval.unit, entry.interval.value)
        if (!nextDue) return
        entries[idx] = { ...entry, dueAt: nextDue, updatedAt: new Date().toISOString() }
        fs.writeFileSync(absPath, JSON.stringify(entries, null, 2), 'utf-8')
      } catch { /* ignore file errors */ }
    })

    notifScheduler.start()
  }

  for (const pattern of ['**/*.anemona-reminder', '**/*.anemona-todo']) {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vaultPath, pattern))
    watcher.onDidCreate(uri => cache?.syncFile(uri.fsPath))
    watcher.onDidChange(uri => cache?.syncFile(uri.fsPath))
    watcher.onDidDelete(uri => cache?.cancelFile(uri.fsPath))
    notifWatchers.push(watcher)
  }

  notesViewProvider.updateBadge(service.getPendingCount())
}

function reloadNotificationsForVault(vaultPath: string, context: vscode.ExtensionContext): void {
  disposeNotifications()
  setupNotificationsForVault(vaultPath, context)
}

export function activate(context: vscode.ExtensionContext): void {
  notesService = new NotesService()
  notesViewProvider = new NotesViewProvider(context.extensionUri, notesService, context.globalState)

  notesViewProvider.onVaultSwitch = (vaultPath) => {
    reloadNotificationsForVault(vaultPath, context)
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NotesViewProvider.viewType,
      notesViewProvider,
    ),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('anemonaVault.showNotifications', () => {
      vscode.commands.executeCommand('anemonaVault.view.focus')
      notesViewProvider.postShowNotifications()
    }),
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
              label: '$(bell) Notifications',
              description: 'View pending notifications',
              action: 'notifications',
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
            {
              label: '$(globe) Language',
              description: 'Change display language',
              action: 'language',
            },
            {
              label: '$(gear) Settings',
              description: 'Open extension settings',
              action: 'settings',
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

        if (selection.action === 'notifications') {
          vscode.commands.executeCommand('anemonaVault.view.focus')
          notesViewProvider.postShowNotifications()
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

        if (selection.action === 'settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', '@ext:mygnet.anemona-vault')
          return
        }

        if (selection.action === 'language') {
          const currentLang = context.globalState.get<string>('locale', 'auto')
          const langPick = await vscode.window.showQuickPick([
            { label: '$(circle-outline) Auto', description: currentLang === 'auto' ? '✓' : '', action: 'auto' },
            { label: '$(symbol-color) Español (es)', description: currentLang === 'es' ? '✓' : '', action: 'es' },
            { label: '$(symbol-color) English (en)', description: currentLang === 'en' ? '✓' : '', action: 'en' },
          ], { title: 'Language', placeHolder: 'Select language' })

          if (!langPick) return

          await context.globalState.update('locale', langPick.action)
          const resolvedLocale = langPick.action === 'auto'
            ? (vscode.env.language === 'es' ? 'es' : 'en')
            : langPick.action
          notesViewProvider.postSetLocale(resolvedLocale)
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'anemonaVault.rebuildScheduledEventsCache',
      () => {
        const storagePath = notesService.getStoragePath()
        if (!storagePath) {
          vscode.window.showErrorMessage('No storage folder configured')
          return
        }
        reloadNotificationsForVault(storagePath, context)
        vscode.window.showInformationMessage('Scheduled events cache rebuilt')
      },
    ),
  )

  const storagePath = notesService.getStoragePath()
  if (storagePath) {
    const currentVersion = context.extension.packageJSON.version as string
    const lastSeenVersion = context.globalState.get<string>('anemonaVault.lastSeenVersion')

    if (lastSeenVersion !== currentVersion) {
      const changelogUrl = 'https://github.com/mygnet/anemona-vault/blob/main/CHANGELOG.md'
      vscode.window.showInformationMessage(
        `Anémona Vault v${currentVersion}`,
        'View changelog',
      ).then(async (selection) => {
        await context.globalState.update('anemonaVault.lastSeenVersion', currentVersion)
        if (selection === 'View changelog') {
          vscode.env.openExternal(vscode.Uri.parse(changelogUrl))
        }
      })
    }

    setupNotificationsForVault(storagePath, context)
  }

  context.subscriptions.push({ dispose: () => disposeNotifications() })
}

export function deactivate(): void {
  // cleanup handled via context.subscriptions
}
