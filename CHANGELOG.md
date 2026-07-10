# Changelog

## 1.0.7 — 2026-07-09

- **Link manager (Anémona Link)** — New `.anemona-link` note type to save and organize links. Each entry stores a title, URL, and optional description. Import links from CSV (`url | title`) or JSON, export as text, markdown, or JSON, and open URLs directly from the editor. Comes with a dedicated editor, sorting, filtering.
- **Link status checker & auto-fill** — Every link entry now shows whether the site is reachable (green/gray/red indicator). Click the sync button on any entry (or use "Check all") to fetch the page title, description, and favicon — the form auto-fills when adding new links. Sync runs one at a time, can be cancelled mid-way, and scrolls to the current entry as it progresses. If the page is blocked by Cloudflare or similar, you'll see a friendly explanation instead of a generic error.
- **Simpler delete confirmation** — Removing an entry from any editor (links, commands, keys, tasks, snippets, reminders) now uses a simple "Cancel / Delete" dialog instead of typing a random code. The code-based confirmation is kept for deleting entire files, folders, and categories, where the stakes are higher.
- **Visual gallery (Anémona Shot)** — New `.anemona-shot` note type for storing images as visual notes. Create galleries by pasting or importing images. Folder-based structure with `anemona-shot.json` metadata and `images/` directory. Supports drag-and-drop paste, file import, image preview, clipboard copy, metadata editing (title, description, source URL, tags), search/filter, sorting, and theme-compatible styling.
- **Fix: Folder delete navigates to parent** — When deleting the folder you're currently inside, the view now automatically returns to the parent folder instead of staying on the deleted folder.

## 1.0.6 — 2026-06-24

- **Fix: Recurring reminders overflow on short months** — Monthly/yearly reminders now clamp to the last valid day of the target month instead of overflowing (e.g. Jan 31 + 1 month → Feb 28, not Mar 3). Same fix for Feb 29 in non-leap years. Applies to both the scheduler (`computeNextDue` in `extension.ts` and `utils.ts`) and the reminder editor (`computeDueIso` in `ReminderEditor.svelte`).
- **Command documentation** — Command entries now support optional documentation/usage notes, including editing, expand/collapse display, filtering/search, and text/markdown export.

## 1.0.5 — 2026-06-18

- **Fix: View state not reset on vault switch** — When switching between vaults (via Open folder or Recent folders), editors and panels no longer retain stale content from the previous vault. Fixed by clearing the webview state and persisted `getState()` before loading the new vault's data. Prevents confusion when both vaults share category names like "Dev".
- **Fix: Sortable editor indices** — Sorting in Command, Key, and Snippet editors is now visual-only and no longer mutates/saves the underlying entry order. Menus and actions use the real entry index after sorting/filtering, preventing add/edit/delete/copy/insert from targeting the wrong item.
- **Fixes: Common sections and notification UI** — Global Search and Notifications no longer inherit the selected category color; Notifications now support their own persisted color config under `.anemona/notifications/.config.json`, history delete is a compact right-aligned icon action, and notification cards/badges now use theme-controlled colors.
- **Visual/theme improvements** — Unified NotesList, editor, Search, and Notification headers; standardized back icons; added custom color picker support; and expanded theme controls for modals, forms, local search fields, placeholders, status text contrast, breadcrumbs, badges, and section-specific intensities.

## 1.0.4 — 2026-06-18

- **Notification system** — New local notification module for task reminders (due soon, overdue) and system messages. Persistent `.anemona/notifications/` storage with inbox/history/index structure. Badge counter on Activity Bar icon, bell icon in sidebar header with badge, and notification panel with Inbox/History tabs.
- **View state persistence for notifications** — Notification panel remembers active tab (Inbox/History) across view switches.
- **i18n / Internationalization** — Full language support with auto-detect from VS Code (`vscode.env.language`). English (en) and Spanish (es) included. Centralized `t()` function with Svelte reactive store and `{{variable}}` interpolation. Fallback: selected locale → English → raw key. Language selector in the More Actions menu (Auto / Español / English) with persistence via `globalState`. New `webview/src/i18n/` module — adding a new language only requires a JSON file.
- **Reminder notes** — New `.anemona-reminder` note type. JSON-based file format with `text`, `dueAt`, `status` (pending/completed), and action (none/file/url/command/task). Dedicated editor with add/edit/delete/complete, due date picker (hours/days/weeks/months/specific date), and action configuration.
- **Reminder notification support** — Task provider now scans `.anemona-reminder` files and generates due-soon/overdue notifications via the existing scheduler.
- **Scheduled events cache** — New `.anemona/cache/scheduled-events.json` cache for reminders and tasks with due dates. Scheduler now reads only the cache on each check instead of scanning every vault file. Includes automatic initial rebuild, incremental updates on save/delete/move/import, file watchers for `.anemona-reminder` and `.anemona-todo`, and `anemonaVault.rebuildScheduledEventsCache` command.
- **Minute-level due checks** — Scheduler now keeps scheduled events in memory and compares due timestamps every minute. The JSON cache is reloaded on cache changes and periodically via `notifications.checkIntervalMinutes` as a fallback refresh interval.
- **Reminder search & export** — Full-text search across reminder text/status, and export as JSON/plain-text/markdown.
- **UI improvements** — Reload overlay with spinner animation, initial loading indicator on startup, larger sidebar icons, subtle divider between icon toolbar and category tabs, visual type selector grid replacing dropdowns, editor header icons per file type, form validation with red borders on empty required fields, clickable URL globe icon on reminder cards, sticky Add button in editors, simplified reminder form, and normalized notification history order.
- **Fix: Filtered list actions** — edit, delete, copy, and insert now target the correct item when a search/filter is active, instead of always acting on the first unfiltered entry.
- **Fix: Global search includes new fields** — Global search now finds reminders by title and tasks by description.
- **Fix: Import success toast** — Shows a confirmation message when content import completes.
- **UI: Search clear button** — Search inputs now show an X button to clear the filter.
- **UI: Priority filter in tasks** — Priority filter button (P/H/M/L) restored alongside the search bar.
- **UI: Unified editor styles** — Editors now share common styles for a more consistent appearance.

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
