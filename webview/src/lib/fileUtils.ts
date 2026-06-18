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
