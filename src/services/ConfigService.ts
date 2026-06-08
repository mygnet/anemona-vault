import * as vscode from 'vscode'

export class ConfigService {
  static getStoragePath(): string | undefined {
    const path = vscode.workspace
      .getConfiguration('anemona-vault')
      .get<string>('storagePath')
    return path && path.trim() !== '' ? path : undefined
  }

  static async setStoragePath(path: string): Promise<void> {
    await vscode.workspace
      .getConfiguration('anemona-vault')
      .update('storagePath', path, vscode.ConfigurationTarget.Global)
  }

  static getDefaultCategories(): string[] {
    const categories = vscode.workspace
      .getConfiguration('anemona-vault')
      .get<string[]>('defaultCategories')
    return categories ?? []
  }
}
