# Anémona Vault

Your developer workspace inside Visual Studio Code.

Organize everything you use every day in one place — notes, secrets, tasks, commands, and code snippets — all accessible from a dedicated sidebar.

<img src="screenshot/01.gif" alt="Anémona Vault demo" width="100%">

## Features

### Note types

| Type | Extension | Icon | Description |
|------|-----------|------|-------------|
| Text | `.md` | 📄 | Free-form markdown notes with search |
| Key | `.anemona-key` / `.anemona-lock` | 🔑 / 🔒 | Encrypted secrets, passwords, API tokens |
| Command | `.anemona-command` | ⌘ | Reusable shell commands with copy |
| Todo | `.anemona-todo` | ☑️ | Task tracking with progress, priorities, and due dates |
| Snippet | `.anemona-snippet` | 📋 | Code snippets with language tagging and copy |

### Vault management

- **Multiple vaults** — Switch between different vault folders from the sidebar
- **Categories** — Group notes into named sections, each with its own color
- **Folders** — Organize notes inside categories with arbitrary nesting
- **Encryption** — Lock/unlock individual key files with a password (AES-256-GCM)
- **Import / Export** — Full vault backup and restore via ZIP
- **Search** — Global search across all note types and categories

### Per-type capabilities

- **Markdown** — Full-text editing with search and highlight
- **Keys** — Add/edit/delete credential entries with title, username, password, email, URL, host, port, token, and notes; copy values to clipboard
- **Commands** — Store and copy shell commands; sort and filter
- **Todos** — Track progress (0–100%), set priority (low/medium/high) and due dates, mark as done/cancelled
- **Snippets** — Store code with language selection (30+ languages), copy code to clipboard, filter and sort

### UX

- **Compact sidebar** — Responsive layout designed for VS Code's narrow sidebar
- **Accent colors** — Per-category color theming
- **Filtering** — Inline filter for each note type's entries
- **Confirmation dialogs** — Code-based delete confirmation to prevent accidental loss

## Gallery

<table>
  <tr>
    <td width="50%">
      <img src="screenshot/02.gif" alt="Drag & drop folders" width="100%">
      <br>
      <em>Drag & drop — move folders between categories</em>
    </td>
    <td width="50%">
      <img src="screenshot/03.gif" alt="Commands and snippets" width="100%">
      <br>
      <em>Commands & snippets — add, edit, and organize</em>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshot/04.gif" alt="Snippets and tasks" width="100%">
      <br>
      <em>Snippets & tasks — filter, sort, change status</em>
    </td>
    <td width="50%">
      <img src="screenshot/05.gif" alt="Markdown and keys" width="100%">
      <br>
      <em>Markdown notes & keys — copy passwords with one click</em>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshot/09.gif" alt="Task management" width="100%">
      <br>
      <em>Tasks — detailed view with progress, priority, and due dates</em>
    </td>
    <td width="50%">
      <img src="screenshot/10.gif" alt="Lock key file" width="100%">
      <br>
      <em>Lock — protect key files with a password</em>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <img src="screenshot/11.gif" alt="Unlock key file" width="100%">
      <br>
      <em>Unlock — open protected key files with your password</em>
    </td>
  </tr>
</table>

## Storage

All data is stored as plain files on your local filesystem. Choose any folder as your vault root.

```
vault/
├── .config.json             # vault config (encryption key, colors)
├── Notes/
│   ├── .config.json         # category config (color, icon)
│   ├── meeting-notes.md
│   ├── apis.anemona-key
│   ├── deploy.anemona-command
│   ├── ideas.anemona-snippet
│   └── subfolder/
│       └── references.md
└── Projects/
    └── ...
```

## Important

When you copy a vault folder or one of its internal folders, include the `.config.json` file too. That file stores the configuration and the encryption key used to read protected entries.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
