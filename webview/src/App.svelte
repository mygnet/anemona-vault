<script lang="ts">
  import CategoryTabs from './components/CategoryTabs.svelte'
  import NotesList from './components/NotesList.svelte'
  import NoteEditor from './components/NoteEditor.svelte'
  import KeyEditor from './components/KeyEditor.svelte'
  import CommandEditor from './components/CommandEditor.svelte'
  import TodoEditor from './components/TodoEditor.svelte'
  import SnippetEditor from './components/SnippetEditor.svelte'
  import SearchPanel from './components/SearchPanel.svelte'

  declare function acquireVsCodeApi(): {
    postMessage(message: Record<string, unknown>): void
    getState(): Record<string, unknown> | undefined
    setState(state: Record<string, unknown>): void
  }

  const vscode = acquireVsCodeApi()
  const savedState = vscode.getState() || {}

  let categories: { name: string; path: string; config?: { color?: string; icon?: string }; canDelete?: boolean }[] = []
  let selectedCategory = ''
  let notes: { name: string; filePath: string; fileType?: string; displayName?: string; icon?: string; progress?: number }[] = []
  let folders: { name: string; path: string; color?: string; isEmpty?: boolean }[] = []
  let currentFolderPath = ''
  let parentFolderPath: string | null = null
  let folderBreadcrumb: string[] = []
  let selectedNote: { name: string; filePath: string; fileType?: string } | null = null
  let noteContent = ''
  let needsStoragePath = false
  let recentFolders: { path: string; name: string; icon?: string; lastOpened: string }[] = []
  let reloading = false
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let tabsCollapsed = Boolean(savedState.tabsCollapsed)
  let activeSection: 'notes' | 'search' = savedState.activeSection === 'search' ? 'search' : 'notes'

  let keyEntries: { title: string; password: string; note?: string; url?: string; email?: string; username?: string; host?: string; port?: string }[] = []
  let keyLocked = false
  let commandEntries: { title: string; command: string }[] = []
  let todoEntries: { title: string; progress: number; status: 'open' | 'done' | 'cancelled'; priority: 'low' | 'medium' | 'high'; dueAt?: string }[] = []
  let snippetEntries: { title: string; language: string; code: string }[] = []
  let globalSearchQuery = ''
  let globalSearchLoading = false
  let globalSearchResults: {
    category: string
    noteName: string
    filePath: string
    fileType: 'md' | 'key' | 'command' | 'todo' | 'snippet'
    displayName: string
    matchLabel: string
    snippet: string
  }[] = []
  let pendingGlobalFilter: { filePath: string; query: string; fileType: string } | null = null
  let currentFileType: string = 'md'
  let effectiveConfig: { color?: string; icon?: string; file?: Record<string, { progress?: number }> } = {}
  let errorMessage = ''
  let errorTimer: ReturnType<typeof setTimeout> | null = null
  let deletePrompt:
    | { type: 'note'; label: string; code: string; note: { name: string; filePath: string } }
    | { type: 'category'; label: string; code: string; category: string }
    | { type: 'folder'; label: string; code: string; folder: { name: string; path: string } }
    | null = null
  let deleteCodeInput = ''
  let renamePrompt:
    | { type: 'note'; label: string; value: string; note: { name: string; filePath: string } }
    | { type: 'category'; label: string; value: string; category: string }
    | null = null
  let renameInput = ''
  let movePrompt: { item: { name: string; path: string }; isFolder: boolean } | null = null
  let selectedMoveCategory = ''
  let moveFolderTree: { name: string; path: string; children: { name: string; path: string; children: any[] }[] }[] = []
  let selectedMoveFolder = ''
  let exportPrompt: { note: { name: string; filePath: string; fileType?: string }; formats: { label: string; value: string }[] } | null = null
  let selectedExportFormat = ''

  function focus(node: HTMLInputElement) {
    node.focus()
    return {}
  }

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
      case 'activateSearch':
        handleOpenSearch()
        break

      case 'storagePathRequired':
        needsStoragePath = true
        recentFolders = message.recentFolders || []
        break

      case 'recentFolders':
        recentFolders = message.recentFolders || []
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
        folders = message.folders || []
        currentFolderPath = String(message.currentFolder || '')
        parentFolderPath = message.parentFolder || null
        folderBreadcrumb = currentFolderPath ? currentFolderPath.split('/') : []
        effectiveConfig = message.effectiveConfig || {}
        if (reloadTimer) clearTimeout(reloadTimer)
        reloadTimer = setTimeout(() => { reloading = false }, 700)
        break

      case 'noteContent':
        selectedNote = { name: message.note.name, filePath: message.note.filePath, fileType: message.fileType }
        currentFileType = message.fileType
        effectiveConfig = message.effectiveConfig || {}
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
          snippetEntries = []
        } else if (message.fileType === 'snippet') {
          snippetEntries = message.entries || []
          noteContent = ''
          keyEntries = []
          commandEntries = []
          todoEntries = []
        } else {
          noteContent = message.content || ''
          keyEntries = []
          commandEntries = []
          todoEntries = []
          snippetEntries = []
        }
        break

      case 'globalSearchResults':
        globalSearchLoading = false
        globalSearchQuery = String(message.query || '')
        globalSearchResults = message.results || []
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

      case 'noteMoved':
        if (selectedNote && selectedNote.filePath === message.notePath) {
          selectedNote = null
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

      case 'folderTree':
        moveFolderTree = message.tree || []
        break

      case 'folderDeleted':
      case 'folderMoved':
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
    activeSection = 'notes'
    pendingGlobalFilter = null
    selectedCategory = category
    selectedNote = null
    noteContent = ''
    keyEntries = []
    commandEntries = []
    todoEntries = []
    snippetEntries = []
    currentFolderPath = ''
    parentFolderPath = null
    folderBreadcrumb = []
    folders = []
    effectiveConfig = {}
    vscode.postMessage({ command: 'selectCategory', category, folderPath: '' })
  }

  function handleSelectNote(note: { name: string; filePath: string }) {
    activeSection = 'notes'
    pendingGlobalFilter = null
    vscode.postMessage({ command: 'selectNote', category: selectedCategory, note: note.name })
  }

  function handleOpenSearch() {
    activeSection = 'search'
    selectedNote = null
    noteContent = ''
    keyEntries = []
    commandEntries = []
    todoEntries = []
    snippetEntries = []
    persistUiState()
  }

  function handleCloseSearch() {
    activeSection = 'notes'
    persistUiState()
  }

  function handleOpenFolder(folder: { name: string; path: string }) {
    const relativePath = currentFolderPath
      ? currentFolderPath + '/' + folder.name
      : folder.name
    vscode.postMessage({ command: 'openFolder', category: selectedCategory, folderPath: relativePath })
  }

  function handleFolderBack() {
    if (parentFolderPath !== null) {
      vscode.postMessage({ command: 'openFolder', category: selectedCategory, folderPath: parentFolderPath || '' })
    }
  }

  function handleBreadcrumbClick(index: number) {
    const path = folderBreadcrumb.slice(0, index + 1).join('/')
    vscode.postMessage({ command: 'openFolder', category: selectedCategory, folderPath: path || '' })
  }

  function handleCreateFolder(name: string) {
    if (!selectedCategory) return
    const parentPath = currentFolderPath
      ? (categories.find(c => c.name === selectedCategory)?.path || '') + '/' + currentFolderPath
      : (categories.find(c => c.name === selectedCategory)?.path || '')
    vscode.postMessage({ command: 'createFolder', parentPath, name })
  }

  function handleDeleteFolder(folder: { name: string; path: string }) {
    deletePrompt = {
      type: 'folder',
      label: folder.name,
      code: generateDeleteCode(),
      folder,
    }
    deleteCodeInput = ''
  }

  function handleRenameFolder(folder: { name: string; path: string }, newName: string) {
    vscode.postMessage({ command: 'renameFolder', folderPath: folder.path, name: newName })
  }

  function handleMoveFolder(item: { name: string; path: string }) {
    vscode.postMessage({ command: 'moveFolder', sourcePath: item.path, targetDir: item.path })
  }

  function handleUpdateFolderColor(folder: { name: string; path: string }, color: string) {
    vscode.postMessage({ command: 'updateFolderColor', folderPath: folder.path, color })
  }

  function handleSearchGlobal(event: CustomEvent<string>) {
    const query = event.detail
    globalSearchQuery = query

    if (!query.trim()) {
      globalSearchLoading = false
      globalSearchResults = []
      return
    }

    globalSearchLoading = true
    vscode.postMessage({ command: 'searchGlobal', query })
  }

  function handleOpenSearchResult(event: CustomEvent<(typeof globalSearchResults)[number]>) {
    const result = event.detail
    const categoryPath = categories.find(c => c.name === result.category)?.path || ''
    const fileDir = result.filePath.substring(0, result.filePath.lastIndexOf('/'))
    const relativeFolder = fileDir.startsWith(categoryPath) && fileDir.length > categoryPath.length
      ? fileDir.substring(categoryPath.length + 1)
      : ''

    activeSection = 'notes'
    selectedCategory = result.category
    selectedNote = null
    noteContent = ''
    keyEntries = []
    commandEntries = []
    todoEntries = []
    snippetEntries = []
    currentFolderPath = relativeFolder
    parentFolderPath = relativeFolder ? relativeFolder.split('/').slice(0, -1).join('/') || '' : null
    folderBreadcrumb = relativeFolder ? relativeFolder.split('/') : []
    folders = []
    pendingGlobalFilter = {
      filePath: result.filePath,
      query: globalSearchQuery,
      fileType: result.fileType,
    }
    persistUiState()
    vscode.postMessage({ command: 'selectCategory', category: result.category, folderPath: relativeFolder })
    vscode.postMessage({ command: 'selectNote', category: result.category, note: result.noteName })
  }

  function handleOpenRecentFolder(folderPath: string) {
    vscode.postMessage({ command: 'openRecentFolder', folderPath })
  }

  function handleCreateNote(title: string, type: string = 'md') {
    if (!selectedCategory) return
    if (type === 'folder') {
      handleCreateFolder(title)
      return
    }
    vscode.postMessage({ command: 'createNote', category: selectedCategory, title, fileType: type, folderPath: currentFolderPath })
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

  function handleMoveNote(note: { name: string; filePath: string }) {
    selectedMoveCategory = categories.find((c) => c.name !== selectedCategory)?.name || ''
    selectedMoveFolder = ''
    moveFolderTree = []
    movePrompt = { item: { name: note.name, path: note.filePath }, isFolder: false }
    if (selectedMoveCategory) {
      vscode.postMessage({ command: 'getFolderTree', categoryName: selectedMoveCategory })
    }
  }

  function handleMoveFolderTrigger(folder: { name: string; path: string }) {
    selectedMoveCategory = selectedCategory
    selectedMoveFolder = ''
    moveFolderTree = []
    movePrompt = { item: { name: folder.name, path: folder.path }, isFolder: true }
    vscode.postMessage({ command: 'getFolderTree', categoryName: selectedCategory })
  }

  function handleMoveCategoryChange() {
    selectedMoveFolder = ''
    moveFolderTree = []
    if (selectedMoveCategory) {
      vscode.postMessage({ command: 'getFolderTree', categoryName: selectedMoveCategory })
    }
  }

  function handleExportNote(note: { name: string; filePath: string; fileType?: string }) {
    const fileType = note.fileType || 'md'
    let formats: { label: string; value: string }[]
    if (fileType === 'key') {
      formats = [
        { label: 'Default (encrypted JSON)', value: 'default' },
        { label: 'Decrypted (plain JSON)', value: 'en-claro' },
      ]
    } else if (fileType === 'command') {
      formats = [
        { label: 'Default (JSON)', value: 'default' },
        { label: 'Text', value: 'texto' },
        { label: 'Markdown', value: 'markdown' },
      ]
    } else if (fileType === 'todo') {
      formats = [
        { label: 'Default (JSON)', value: 'default' },
        { label: 'Text', value: 'texto' },
        { label: 'Markdown', value: 'markdown' },
      ]
    } else if (fileType === 'snippet') {
      formats = [
        { label: 'Default (JSON)', value: 'default' },
        { label: 'Text', value: 'texto' },
        { label: 'Markdown', value: 'markdown' },
      ]
    } else {
      formats = [{ label: 'Default (markdown)', value: 'default' }]
    }
    selectedExportFormat = formats[0].value
    exportPrompt = { note, formats }
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
    snippetEntries = []
    pendingGlobalFilter = null
    effectiveConfig = {}
  }

  function confirmMoveNote() {
    if (!movePrompt || !selectedMoveCategory) return
    if (movePrompt.isFolder) {
      const targetDir = selectedMoveFolder
        ? (categories.find(c => c.name === selectedMoveCategory)?.path || '') + '/' + selectedMoveFolder
        : (categories.find(c => c.name === selectedMoveCategory)?.path || '')
      vscode.postMessage({
        command: 'moveFolder',
        sourcePath: movePrompt.item.path,
        targetDir,
      })
    } else {
      vscode.postMessage({
        command: 'moveNote',
        notePath: movePrompt.item.path,
        targetCategory: selectedMoveCategory,
        targetFolderPath: selectedMoveFolder || undefined,
      })
    }
    movePrompt = null
  }

  function cancelMovePrompt() {
    movePrompt = null
    moveFolderTree = []
  }

  function confirmExportNote() {
    if (!exportPrompt || !selectedExportFormat) return
    vscode.postMessage({
      command: 'exportNote',
      notePath: exportPrompt.note.filePath,
      format: selectedExportFormat,
    })
    exportPrompt = null
  }

  function cancelExportPrompt() {
    exportPrompt = null
  }

  function handleSelectFolder() {
    vscode.postMessage({ command: 'selectStorageFolder' })
  }

  function handleRefresh() {
    if (reloading) return
    reloading = true
    vscode.postMessage({ command: 'refresh' })
  }

  function persistUiState() {
    vscode.setState({ tabsCollapsed, activeSection })
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

  function handleSnippetSave(event: CustomEvent<typeof snippetEntries>) {
    if (!selectedNote) return
    snippetEntries = event.detail
    vscode.postMessage({
      command: 'saveSnippetEntries',
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
      .replace(/\.anemona-snippet$/, '')
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
    } else if (deletePrompt.type === 'folder') {
      vscode.postMessage({ command: 'deleteFolder', folderPath: deletePrompt.folder.path })
    } else {
      vscode.postMessage({ command: 'deleteCategory', category: deletePrompt.category })
    }

    cancelDeletePrompt()
  }

  window.addEventListener('message', handleMessage)

  import { onMount } from 'svelte'
  onMount(() => { handleReady() })

  $: selectedColorRaw = effectiveConfig.color || categories.find((c) => c.name === selectedCategory)?.config?.color || ''
  $: selectedColor = resolveAccentColor(selectedColorRaw)
  $: selectedCategoryCanDelete = categories.find((c) => c.name === selectedCategory)?.canDelete === true
  $: selectedCategoryConfig = categories.find((c) => c.name === selectedCategory)?.config || {}
  $: activeEditorSearchText = selectedNote && pendingGlobalFilter?.filePath === selectedNote.filePath
    ? pendingGlobalFilter.query
    : ''
</script>

<main>
  {#if needsStoragePath}
    {#if recentFolders.length > 0}
      <div class="recent-folders">
        <h2 class="recent-title">Recent folders</h2>
        <div class="recent-grid">
          {#each recentFolders as folder}
            <button class="recent-card" on:click={() => handleOpenRecentFolder(folder.path)}>
              <span class="recent-icon anemona {folder.icon ? folder.icon : 'icon-folder'}"></span>
              <span class="recent-name">{folder.name}</span>
            </button>
          {/each}
        </div>
        <div class="recent-footer">
          <button class="btn" on:click={handleSelectFolder}>Browse other folder</button>
        </div>
      </div>
    {:else}
      <div class="setup">
        <p>Select a folder to store your notes</p>
        <button class="btn primary" on:click={handleSelectFolder}>Select Folder</button>
      </div>
    {/if}
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
        {:else if activeSection === 'search' && !selectedNote}
          <SearchPanel
            query={globalSearchQuery}
            loading={globalSearchLoading}
            results={globalSearchResults}
            on:close={handleCloseSearch}
            on:search={handleSearchGlobal}
            on:open={handleOpenSearchResult}
          />
        {:else if selectedNote && currentFileType === 'key'}
          <KeyEditor
            entries={keyEntries}
            locked={keyLocked}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            on:save={handleKeySave}
            on:back={handleBack}
            on:unlock={handleUnlock}
            on:lock={handleLock}
          />
        {:else if selectedNote && currentFileType === 'command'}
          <CommandEditor
            entries={commandEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            on:save={handleCommandSave}
            on:back={handleBack}
          />
        {:else if selectedNote && currentFileType === 'todo'}
          <TodoEditor
            entries={todoEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            on:save={handleTodoSave}
            on:back={handleBack}
          />
        {:else if selectedNote && currentFileType === 'snippet'}
          <SnippetEditor
            entries={snippetEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            on:save={handleSnippetSave}
            on:back={handleBack}
          />
        {:else if selectedNote}
          <NoteEditor
            {noteContent}
            {selectedNote}
            searchText={activeEditorSearchText}
            onSave={handleSaveNote}
            onBack={handleBack}
          />
        {:else}
          <NotesList
            {notes}
            {folders}
            {selectedCategory}
            {parentFolderPath}
            {folderBreadcrumb}
            selectedCategoryConfig={selectedCategoryConfig}
            canDeleteCategory={selectedCategoryCanDelete}
            onSelect={handleSelectNote}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
            onDeleteCategory={handleDeleteCategory}
            onRename={handleRenameNote}
            onMove={handleMoveNote}
            onExport={handleExportNote}
            onRenameCategory={handleRenameCategory}
            onUpdateCategoryColor={handleUpdateCategoryColor}
            onOpenFolder={handleOpenFolder}
            onFolderBack={handleFolderBack}
            onBreadcrumbClick={handleBreadcrumbClick}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
            onMoveFolder={handleMoveFolderTrigger}
            onUpdateFolderColor={handleUpdateFolderColor}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if reloading}
    <div class="reload-overlay">
      <span class="reload-spinner"></span>
      <span>Reloading…</span>
    </div>
  {/if}

  {#if deletePrompt}
    <button class="delete-modal-backdrop" on:click={cancelDeletePrompt} aria-label="Close delete confirmation"></button>
    <div class="delete-modal">
      <h3>{deletePrompt.type === 'note' ? 'Delete file' : deletePrompt.type === 'folder' ? 'Delete folder' : 'Delete category'}</h3>
      <p>Confirm deletion of <strong>{deletePrompt.label}</strong> by typing <strong>{deletePrompt.code}</strong></p>
      <input
        class="delete-code-input"
        type="text"
        bind:value={deleteCodeInput}
        maxlength="4"
        placeholder="Code"
        use:focus
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

  {#if movePrompt}
    <button class="delete-modal-backdrop" on:click={cancelMovePrompt} aria-label="Close move dialog"></button>
    <div class="delete-modal">
      <h3>{movePrompt.isFolder ? 'Move folder' : 'Move file'}</h3>
      <p>Move <strong>{movePrompt.item.name}</strong></p>
      <label class="modal-field-label" for="move-category-select">Category</label>
      <select id="move-category-select" class="move-select" bind:value={selectedMoveCategory} on:change={handleMoveCategoryChange}>
        {#each categories.filter(c => !movePrompt.isFolder || c.name !== selectedCategory) as cat}
          <option value={cat.name}>{cat.name}</option>
        {/each}
      </select>
      <label class="modal-field-label" for="move-folder-select">Folder (optional)</label>
      <select id="move-folder-select" class="move-select" bind:value={selectedMoveFolder}>
        <option value="">Root (default)</option>
        {#each moveFolderTree as f1}
          <option value={f1.name}>{f1.name}</option>
          {#if f1.children}
            {#each f1.children as f2}
              <option value={f1.name + '/' + f2.name}>— {f2.name}</option>
              {#if f2.children}
                {#each f2.children as f3}
                  <option value={f1.name + '/' + f2.name + '/' + f3.name}>—— {f3.name}</option>
                {/each}
              {/if}
            {/each}
          {/if}
        {/each}
      </select>
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelMovePrompt}>Cancel</button>
        <button class="btn primary" on:click={confirmMoveNote}>Move</button>
      </div>
    </div>
  {/if}

  {#if exportPrompt}
    <button class="delete-modal-backdrop" on:click={cancelExportPrompt} aria-label="Close export dialog"></button>
    <div class="delete-modal">
      <h3>Export</h3>
      <p>Export <strong>{exportPrompt.note.name}</strong> as</p>
      {#each exportPrompt.formats as fmt}
        <label class="export-option">
          <input type="radio" bind:group={selectedExportFormat} value={fmt.value} />
          <span>{fmt.label}</span>
        </label>
      {/each}
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelExportPrompt}>Cancel</button>
        <button class="btn primary" on:click={confirmExportNote}>Export</button>
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
    --ui-font-title: 0.7rem;
    --ui-font-entry: 0.66rem;
    --ui-font-control: 0.64rem;
    --ui-icon-btn-size: 1.24rem;
    --ui-toolbar-btn-size: 1.3rem;
    --ui-control-height: 1.34rem;
    --ui-control-height-sm: 1.28rem;
    --ui-control-pad-x: 0.38rem;
    --ui-control-pad-y: 0.26rem;
    --ui-search-icon-left: 0.56rem;
    --ui-search-input-pad-left: 1.56rem;
    --ui-card-pad-x: 0.34rem;
    --ui-card-pad-y: 0.28rem;
    --ui-menu-pad-x: 0.34rem;
    --ui-menu-pad-y: 0.26rem;
    --ui-menu-font: 0.64rem;
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
    padding: 0.3rem 0.62rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-control);
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
    word-break: break-word;
  }

  .delete-code-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--ui-font-control);
  }

  .rename-input,
  .move-select {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    margin-bottom: 0.8rem;
    font-size: var(--ui-font-control);
  }

  .delete-code-input:focus,
  .rename-input:focus,
  .move-select:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .modal-field-label {
    display: block;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    margin-bottom: 0.2rem;
    margin-top: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .modal-field-label:first-of-type {
    margin-top: 0;
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 0.34rem;
    padding: 0.2rem 0;
    cursor: pointer;
    font-size: var(--ui-font-control);
    color: var(--vscode-foreground);
  }

  .export-option input[type="radio"] {
    accent-color: var(--vscode-textLink-foreground);
    margin: 0;
  }

  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-gap-2);
  }

  .recent-folders {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
    gap: 0.8rem;
    box-sizing: border-box;
  }

  .recent-title {
    font-size: var(--ui-font-md);
    font-weight: 500;
    color: var(--ui-muted);
    margin: 0;
  }

  .recent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.5rem;
    width: 100%;
    max-width: 480px;
  }

  .recent-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.7rem 0.4rem;
    background: var(--ui-soft);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-lg);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    text-align: center;
  }

  .recent-card:hover {
    background: var(--ui-soft-2);
    border-color: var(--ui-border-strong);
  }

  .recent-icon {
    font-size: 1.8rem;
    opacity: 0.75;
  }

  .recent-name {
    font-size: var(--ui-font-xs);
    color: var(--vscode-foreground);
    word-break: break-word;
    line-height: 1.2;
  }

  .recent-footer {
    display: flex;
    gap: 0.4rem;
  }

  .reload-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
    backdrop-filter: blur(3px);
    font-size: var(--ui-font-md);
    color: var(--vscode-foreground);
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .reload-spinner {
    width: 2.6rem;
    height: 2.6rem;
    border: 3px solid var(--ui-border);
    border-top-color: var(--vscode-textLink-foreground);
    border-radius: 50%;
    animation: reload-spin 0.6s linear infinite;
  }

  @keyframes reload-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
