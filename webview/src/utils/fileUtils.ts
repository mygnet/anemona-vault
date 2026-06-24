export function resolveColorValue(color?: string, fallback?: string): string {
  switch (color) {
    case "vscode-default":
      return "var(--vscode-sideBarTitle-foreground)";
    case "vscode-muted":
      return "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)";
    case "vscode-soft":
      return "var(--vscode-editor-background)";
    default:
      return color || fallback || "var(--vscode-textLink-foreground)";
  }
}

export function getDisplayName(name: string): string {
  return name.replace(/\.(anemona-(lock|key|command|todo|snippet|reminder)|md)$/, '')
}

export function getFileIconClass(name: string): string {
  if (name.endsWith('.anemona-lock')) return 'icon-file-lock'
  if (name.endsWith('.anemona-key')) return 'icon-key-solid'
  if (name.endsWith('.anemona-command')) return 'icon-terminal'
  if (name.endsWith('.anemona-todo')) return 'icon-list-todo'
  if (name.endsWith('.anemona-snippet')) return 'icon-code-xml'
  if (name.endsWith('.anemona-reminder')) return 'icon-alarm-clock'
  return 'icon-file-text'
}

export function getFileTypeIconClass(fileType?: string, name?: string): string {
  if (name?.endsWith('.anemona-lock')) return 'icon-file-lock'
  if (fileType === 'key') return 'icon-key-solid'
  if (fileType === 'command') return 'icon-terminal'
  if (fileType === 'todo') return 'icon-list-todo'
  if (fileType === 'snippet') return 'icon-code-xml'
  if (fileType === 'reminder') return 'icon-alarm-clock'
  return name ? getFileIconClass(name) : 'icon-file-text'
}

export function resolveFolderAccent(color?: string): string | undefined {
  if (
    !color ||
    color === 'vscode-default' ||
    color === 'vscode-muted' ||
    color === 'vscode-soft'
  ) {
    return undefined
  }
  return color
}
