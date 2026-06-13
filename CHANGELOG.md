# Changelog

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
