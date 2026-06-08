<script lang="ts">
  import CategoryTabs from './components/CategoryTabs.svelte'
  import NotesList from './components/NotesList.svelte'
  import NoteEditor from './components/NoteEditor.svelte'
  import KeyEditor from './components/KeyEditor.svelte'
  import CommandEditor from './components/CommandEditor.svelte'
  import TodoEditor from './components/TodoEditor.svelte'

  declare function acquireVsCodeApi(): {
    postMessage(message: Record<string, unknown>): void
    getState(): Record<string, unknown> | undefined
    setState(state: Record<string, unknown>): void
  }

  const vscode = acquireVsCodeApi()
  const savedState = vscode.getState() || {}

  let categories: { name: string; path: string; config?: { color?: string; icon?: string }; canDelete?: boolean }[] = []
  let selectedCategory = ''
  let notes: { name: string; filePath: string; fileType?: string; displayName?: string; icon?: string }[] = []
  let selectedNote: { name: string; filePath: string; fileType?: string } | null = null
  let noteContent = ''
  let needsStoragePath = false
  let tabsCollapsed = Boolean(savedState.tabsCollapsed)

  let keyEntries: { title: string; password: string; note?: string; url?: string; email?: string; username?: string; host?: string; port?: string }[] = []
  let keyLocked = false
  let commandEntries: { title: string; command: string }[] = []
  let todoEntries: { title: string; progress: number; status: 'open' | 'done' | 'cancelled'; priority: 'low' | 'medium' | 'high'; dueAt?: string }[] = []
  let currentFileType: string = 'md'
  let errorMessage = ''
  let errorTimer: ReturnType<typeof setTimeout> | null = null
  let deletePrompt:
    | { type: 'note'; label: string; code: string; note: { name: string; filePath: string } }
    | { type: 'category'; label: string; code: string; category: string }
    | null = null
  let deleteCodeInput = ''
  let renamePrompt:
    | { type: 'note'; label: string; value: string; note: { name: string; filePath: string } }
    | { type: 'category'; label: string; value: string; category: string }
    | null = null
  let renameInput = ''

  function resolveAccentColor(color?: string): string {
    switch (color) {
      case 'vscode-default':
        return 'var(--vscode-sideBarTitle-foreground)'
      case 'vscode-muted':
        return 'color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)'
      case 'vscode-soft':
        return 'var(--vscode-editor-background)'
      default:
        return color || 'var(--vscode-textLink-foreground)'
    }
  }


  function handleMessage(event: MessageEvent) {
    const message = event.data

    switch (message.command) {
      case 'storagePathRequired':
        needsStoragePath = true
        break

      case 'categoriesLoaded':
        categories = message.categories
        needsStoragePath = false
        if (selectedCategory && !categories.some((category) => category.name === selectedCategory)) {
          selectedCategory = ''
          selectedNote = null
          noteContent = ''
          keyEntries = []
          commandEntries = []
          todoEntries = []
          notes = []
        }
        if (categories.length > 0 && !selectedCategory) {
          selectedCategory = categories[0].name
          vscode.postMessage({ command: 'selectCategory', category: selectedCategory })
        }
        break

      case 'notesLoaded':
        notes = message.notes
        break

      case 'noteContent':
        selectedNote = { name: message.note.name, filePath: message.note.filePath, fileType: message.fileType }
        currentFileType = message.fileType
        if (message.fileType === 'key') {
          keyEntries = message.entries || []
          keyLocked = message.locked || false
          noteContent = ''
          commandEntries = []
          todoEntries = []
        } else if (message.fileType === 'command') {
          commandEntries = message.entries || []
          noteContent = ''
          keyEntries = []
          todoEntries = []
        } else if (message.fileType === 'todo') {
          todoEntries = message.entries || []
          noteContent = ''
          keyEntries = []
          commandEntries = []
        } else {
          noteContent = message.content || ''
          keyEntries = []
          commandEntries = []
          todoEntries = []
        }
        break

      case 'noteCreated':
      case 'noteSaved':
      case 'noteDeleted':
        break

      case 'noteRenamed':
        if (selectedNote && selectedNote.filePath === message.notePath) {
          const newName = String(message.newPath).split(/[/\\]/).pop() || selectedNote.name
          selectedNote = {
            ...selectedNote,
            name: newName,
            filePath: message.newPath,
          }
        }
        break

      case 'categoryRenamed':
        if (selectedCategory === message.category) {
          selectedCategory = String(message.newName)
        }
        selectedNote = null
        noteContent = ''
        keyEntries = []
        commandEntries = []
        todoEntries = []
        break

      case 'categoryDeleted':
        selectedNote = null
        noteContent = ''
        keyEntries = []
        commandEntries = []
        todoEntries = []
        break

      case 'error':
        console.error(message.message)
        errorMessage = String(message.message)
        if (errorTimer) clearTimeout(errorTimer)
        errorTimer = setTimeout(() => { errorMessage = '' }, 5000)
        break
    }
  }

  function handleSelectCategory(category: string) {
    selectedCategory = category
    selectedNote = null
    noteContent = ''
    keyEntries = []
    commandEntries = []
    todoEntries = []
    vscode.postMessage({ command: 'selectCategory', category })
  }

  function handleSelectNote(note: { name: string; filePath: string }) {
    vscode.postMessage({ command: 'selectNote', category: selectedCategory, note: note.name })
  }

  function handleCreateNote(title: string, fileType: string = 'md') {
    if (!selectedCategory) return
    vscode.postMessage({ command: 'createNote', category: selectedCategory, title, fileType })
  }

  function handleSaveNote(content: string) {
    if (!selectedNote) return
    noteContent = content
    vscode.postMessage({ command: 'saveNote', notePath: selectedNote.filePath, content })
  }

  function handleDeleteNote(note: { name: string; filePath: string }) {
    deletePrompt = {
      type: 'note',
      label: note.name,
      code: generateDeleteCode(),
      note,
    }
    deleteCodeInput = ''
  }

  function handleDeleteCategory(category: string) {
    deletePrompt = {
      type: 'category',
      label: category,
      code: generateDeleteCode(),
      category,
    }
    deleteCodeInput = ''
  }

  function handleRenameNote(note: { name: string; filePath: string }) {
    renamePrompt = {
      type: 'note',
      label: note.name,
      value: getBaseName(note.name),
      note,
    }
    renameInput = getBaseName(note.name)
  }

  function handleRenameCategory(category: string) {
    renamePrompt = {
      type: 'category',
      label: category,
      value: category,
      category,
    }
    renameInput = category
  }

  function handleBack() {
    selectedNote = null
    noteContent = ''
    keyEntries = []
    commandEntries = []
    todoEntries = []
  }

  function handleSelectFolder() {
    vscode.postMessage({ command: 'selectStorageFolder' })
  }

  function handleRefresh() {
    vscode.postMessage({ command: 'refresh' })
  }

  function persistUiState() {
    vscode.setState({ tabsCollapsed })
  }

  function handleToggleTabs() {
    tabsCollapsed = !tabsCollapsed
    persistUiState()
  }

  function handleCreateCategory(name: string) {
    vscode.postMessage({ command: 'createCategory', name })
  }

  function handleUpdateCategoryColor(category: string, color: string) {
    vscode.postMessage({ command: 'updateCategoryColor', category, color })
  }

  function handleKeySave(event: CustomEvent<{ entries: typeof keyEntries; locked: boolean }>) {
    if (!selectedNote) return
    keyEntries = event.detail.entries
    keyLocked = event.detail.locked
    vscode.postMessage({
      command: 'saveKeyEntries',
      notePath: selectedNote.filePath,
      entries: event.detail.entries,
      locked: event.detail.locked,
    })
  }

  function handleCommandSave(event: CustomEvent<typeof commandEntries>) {
    if (!selectedNote) return
    commandEntries = event.detail
    vscode.postMessage({
      command: 'saveCommandEntries',
      notePath: selectedNote.filePath,
      entries: event.detail,
    })
  }

  function handleTodoSave(event: CustomEvent<typeof todoEntries>) {
    if (!selectedNote) return
    todoEntries = event.detail
    vscode.postMessage({
      command: 'saveTodoEntries',
      notePath: selectedNote.filePath,
      entries: event.detail,
    })
  }

  function handleUnlock(event: CustomEvent<string>) {
    vscode.postMessage({ command: 'unlockVault', password: event.detail })
  }

  function handleLock(event: CustomEvent<string>) {
    vscode.postMessage({ command: 'lockVault', password: event.detail })
  }

  function handleReady() {
    vscode.postMessage({ command: 'ready' })
  }

  function generateDeleteCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''

    for (let i = 0; i < 4; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }

    return code
  }

  function cancelDeletePrompt() {
    deletePrompt = null
    deleteCodeInput = ''
  }

  function getBaseName(name: string): string {
    return name
      .replace(/\.anemona-lock$/, '')
      .replace(/\.anemona-key$/, '')
      .replace(/\.anemona-command$/, '')
      .replace(/\.anemona-todo$/, '')
      .replace(/\.md$/, '')
  }

  function cancelRenamePrompt() {
    renamePrompt = null
    renameInput = ''
  }

  function confirmRenamePrompt() {
    const value = renameInput.trim()
    if (!renamePrompt || !value) {
      errorMessage = 'Name is required'
      if (errorTimer) clearTimeout(errorTimer)
      errorTimer = setTimeout(() => { errorMessage = '' }, 5000)
      return
    }

    if (renamePrompt.type === 'note') {
      vscode.postMessage({
        command: 'renameNote',
        notePath: renamePrompt.note.filePath,
        title: value,
      })
    } else {
      vscode.postMessage({
        command: 'renameCategory',
        category: renamePrompt.category,
        name: value,
      })
    }

    cancelRenamePrompt()
  }

  function showDeleteCodeMismatch() {
    errorMessage = 'Confirmation code does not match'
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMessage = '' }, 5000)
  }

  function confirmDeletePrompt() {
    if (!deletePrompt || deleteCodeInput.trim().toUpperCase() !== deletePrompt.code) {
      showDeleteCodeMismatch()
      return
    }

    if (deletePrompt.type === 'note') {
      vscode.postMessage({ command: 'deleteNote', notePath: deletePrompt.note.filePath })
    } else {
      vscode.postMessage({ command: 'deleteCategory', category: deletePrompt.category })
    }

    cancelDeletePrompt()
  }

  window.addEventListener('message', handleMessage)

  import { onMount } from 'svelte'
  onMount(() => { handleReady() })

  $: selectedColorRaw = categories.find((c) => c.name === selectedCategory)?.config?.color || ''
  $: selectedColor = resolveAccentColor(selectedColorRaw)
  $: selectedCategoryCanDelete = categories.find((c) => c.name === selectedCategory)?.canDelete === true
  $: selectedCategoryConfig = categories.find((c) => c.name === selectedCategory)?.config || {}
</script>

<main>
  {#if needsStoragePath}
    <div class="setup">
      <p>Select a folder to store your notes</p>
      <button class="btn primary" on:click={handleSelectFolder}>Select Folder</button>
    </div>
  {:else}
    <div class="layout">
        <CategoryTabs
          {categories}
          {selectedCategory}
          collapsed={tabsCollapsed}
          onSelect={handleSelectCategory}
          onCreateCategory={handleCreateCategory}
          onRenameCategory={handleRenameCategory}
          onToggleCollapse={handleToggleTabs}
        />
      {#if errorMessage}
        <div class="error-toast">{errorMessage}</div>
      {/if}
      <div class="content" style={`--accent-color: ${selectedColor};`}>
        {#if categories.length === 0}
          <div class="empty-content"><p>Add a category to get started</p></div>
        {:else if selectedNote && currentFileType === 'key'}
          <KeyEditor
            entries={keyEntries}
            locked={keyLocked}
            {selectedNote}
            on:save={handleKeySave}
            on:back={handleBack}
            on:unlock={handleUnlock}
            on:lock={handleLock}
          />
        {:else if selectedNote && currentFileType === 'command'}
          <CommandEditor
            entries={commandEntries}
            {selectedNote}
            on:save={handleCommandSave}
            on:back={handleBack}
          />
        {:else if selectedNote && currentFileType === 'todo'}
          <TodoEditor
            entries={todoEntries}
            {selectedNote}
            on:save={handleTodoSave}
            on:back={handleBack}
          />
        {:else if selectedNote}
          <NoteEditor
            {noteContent}
            {selectedNote}
            onSave={handleSaveNote}
            onBack={handleBack}
          />
        {:else}
          <NotesList
            {notes}
            {selectedCategory}
            selectedCategoryConfig={selectedCategoryConfig}
            canDeleteCategory={selectedCategoryCanDelete}
            onSelect={handleSelectNote}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
            onDeleteCategory={handleDeleteCategory}
            onRename={handleRenameNote}
            onRenameCategory={handleRenameCategory}
            onUpdateCategoryColor={handleUpdateCategoryColor}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if deletePrompt}
    <button class="delete-modal-backdrop" on:click={cancelDeletePrompt} aria-label="Close delete confirmation"></button>
    <div class="delete-modal">
      <h3>{deletePrompt.type === 'note' ? 'Delete file' : 'Delete category'}</h3>
      <p>Confirm deletion of <strong>{deletePrompt.label}</strong> by typing <strong>{deletePrompt.code}</strong></p>
      <input
        class="delete-code-input"
        type="text"
        bind:value={deleteCodeInput}
        maxlength="4"
        placeholder="Code"
        on:keydown={(event) => event.key === 'Enter' && confirmDeletePrompt()}
      />
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelDeletePrompt}>Cancel</button>
        <button class="btn danger" on:click={confirmDeletePrompt}>Delete</button>
      </div>
    </div>
  {/if}

  {#if renamePrompt}
    <button class="delete-modal-backdrop" on:click={cancelRenamePrompt} aria-label="Close rename dialog"></button>
    <div class="delete-modal">
      <h3>{renamePrompt.type === 'note' ? 'Rename file' : 'Rename category'}</h3>
      <p>New name for <strong>{renamePrompt.label}</strong></p>
      <input
        class="rename-input"
        type="text"
        bind:value={renameInput}
        placeholder="Name"
        on:keydown={(event) => event.key === 'Enter' && confirmRenamePrompt()}
      />
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelRenamePrompt}>Cancel</button>
        <button class="btn primary" on:click={confirmRenamePrompt}>Save</button>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  :global(#app) {
    --ui-radius-sm: 4px;
    --ui-radius-md: 6px;
    --ui-radius-lg: 10px;
    --ui-gap-1: 0.24rem;
    --ui-gap-2: 0.4rem;
    --ui-gap-3: 0.58rem;
    --ui-gap-4: 0.82rem;
    --ui-font-xs: 0.6rem;
    --ui-font-sm: 0.68rem;
    --ui-font-md: 0.76rem;
    --ui-font-lg: 0.84rem;
    --ui-border: color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
    --ui-border-strong: color-mix(in srgb, var(--vscode-panel-border) 92%, transparent);
    --ui-muted: color-mix(in srgb, var(--vscode-foreground) 62%, transparent);
    --ui-soft: color-mix(in srgb, var(--vscode-sideBar-background) 94%, white 6%);
    --ui-soft-2: color-mix(in srgb, var(--vscode-editor-background) 96%, white 4%);
    --ui-elevated: color-mix(in srgb, var(--vscode-editor-background) 97%, white 3%);
    --ui-hover: color-mix(in srgb, var(--accent-color, var(--vscode-textLink-foreground)) 8%, transparent);
    --ui-active: color-mix(in srgb, var(--accent-color, var(--vscode-textLink-foreground)) 14%, transparent);
    --ui-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  main { height: 100%; overflow: hidden; }

  .setup, .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1.2rem;
    text-align: center;
    gap: var(--ui-gap-2);
    color: var(--ui-muted);
  }

  .btn {
    padding: 0.36rem 0.7rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-sm);
    font-weight: 500;
    background: var(--ui-soft);
    color: var(--vscode-foreground);
    transition: background 0.18s, border-color 0.18s, transform 0.12s;
  }

  .btn:hover { background: var(--ui-soft-2); }
  .btn:active { transform: translateY(1px); }

  .btn.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: color-mix(in srgb, var(--vscode-button-background) 60%, transparent);
  }

  .btn.primary:hover { background: var(--vscode-button-hoverBackground); }

  .btn.danger {
    background: #c0392b;
    color: #fff;
  }

  .btn.danger:hover { background: #e74c3c; }

  .layout {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-sideBar-background);
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    background: color-mix(in srgb, var(--accent-color) 3%, var(--vscode-editor-background));
    border-left: 1px solid color-mix(in srgb, var(--accent-color) 14%, var(--ui-border));
    transition: background 0.2s;
  }

  .error-toast {
    position: fixed;
    bottom: 0.8rem;
    right: 0.8rem;
    left: auto;
    max-width: min(520px, calc(100vw - 1.6rem));
    background: #c0392b;
    color: #fff;
    padding: 0.7rem 0.85rem;
    border-radius: var(--ui-radius-md);
    font-size: var(--ui-font-sm);
    box-shadow: var(--ui-shadow);
    z-index: 100;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid color-mix(in srgb, #c0392b 60%, white 14%);
  }

  .delete-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 30;
  }

  .delete-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(320px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1.1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
  }

  .delete-modal h3 {
    margin: 0 0 0.5rem;
    font-size: var(--ui-font-lg);
    font-weight: 600;
  }

  .delete-modal p {
    margin: 0 0 0.75rem;
    font-size: var(--ui-font-sm);
    line-height: 1.4;
    color: var(--ui-muted);
  }

  .delete-code-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    padding: 0.62rem 0.7rem;
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--ui-font-md);
  }

  .rename-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    padding: 0.62rem 0.7rem;
    margin-bottom: 0.8rem;
    font-size: var(--ui-font-md);
  }

  .delete-code-input:focus,
  .rename-input:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-gap-2);
  }
</style>
