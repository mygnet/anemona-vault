# Changelog

## 1.0.3 — 2026-06-15

- **Drag-and-drop to move files & folders** — Grab any note or folder and drop it onto a target folder to move it instantly. Visual highlight on hover, works like a file explorer. Drop also works on breadcrumb segments (Home icon or any intermediate folder in the path).
- **Import content from selection or file** — Click "Import" in the note menu to parse selected text or a picked file. Recognises JSON, `key: value` pairs, code blocks, task lists, and shell commands across all note types. Maps known fields (username, password, email, etc.) and deduces titles when missing. Supports `.anemona-lock` decryption and cross-vault `.anemona-key` import with automatic source vault key detection.
- **Smart add from selection** — When text is selected in the VS Code editor, clicking "+" in any editor (Key, Command, Todo, Snippet) pre-fills the add modal with detected fields. Parses key:value pairs for keys, command patterns, task markers, and code blocks depending on the editor context.
- **Sticky "Add entry" button** — The add button is now sticky at the bottom of the list when content overflows, and positioned at the top when the list is empty. Applies to NotesList and all four editors.
- **Persistent view state** — The extension now remembers the selected category, current subfolder, and open note across VS Code view switches (e.g. switching to Files explorer and back).

## 1.0.2 — 2026-06-12

- **Config cascade merge on reload** — Configs now merge from root vault → category → subfolder chain. Each child overrides only matching properties, preserving non-overlapping ones. Includes deep merge of per-file progress tracking.
- **Fixed hidden files excluded from ZIP export** — `.config.json` and other hidden files skipped during vault export. Now included so encryption config is preserved in backups.
- **Fixed todo progress in nested subfolders** — Saving todo entries from subfolders (level 3+) wrote progress to the wrong location, causing ghost directories and empty folder display on back navigation.
- **Fixed accent color lost on back navigation** — Going back from a note to the folder list cleared `effectiveConfig`, causing the accent color to fall back to the category default instead of preserving the subfolder's merged config.

## 1.0.1 — 2026-06-12

- **Refactored ZIP to native Node.js** — Replaced `archiver`, `extract-zip`, and `yauzl` dependencies with a custom ZipService using only native `fs`, `path`, and `zlib`. No external dependencies needed.

## 1.0.0 — 2026-06-11

- **Snippet storage** — New `.anemona-snippet` note type with language selector (30+ languages), code preview, and copy-to-clipboard
- **Drag-and-drop category reorder** — Reorder categories by dragging the tab handle
- **Folder management** — Create, rename, delete, and recolor nested folders inside categories
- **Global search** — Search across all note types from a dedicated search panel
- **Vault import/export** — Full vault backup and restore via ZIP with conflict resolution (overwrite/skip)
- **Recent folders** — Quick-access to recently opened vaults from the landing screen
- **Note export** — Export individual notes as JSON, plain text, or markdown
- **Move notes** — Move notes between categories and folders
- **Lock/unlock key files** — Password-protect individual key files with AES-256-GCM encryption
- **Category management** — Create, rename, delete categories with color customization
- **Folder colors** — Per-folder accent color
- **Inline filtering** — Filter entries within each note type editor (keys, commands, todos, snippets)
- **Confirmation dialogs** — Code-based delete confirmation for notes, folders, and categories
- **UI refinements** — Compact sidebar layout, accent color theming, improved empty states

## 0.1.0 — 2026-06-08

- Initial release
- Markdown note management with search and highlight
- Secret and credential management with encryption
- Task and to-do tracking with progress
- Command library with copy and sort
- Local-first file storage
