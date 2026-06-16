<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { smartPopover } from '../utils/smartPopover'

  const SUPPORTED_LANGUAGES = [
    'text', 'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'kotlin',
    'swift', 'ruby', 'php', 'c', 'cpp', 'csharp', 'sql', 'bash', 'zsh',
    'yaml', 'json', 'xml', 'html', 'css', 'scss', 'less', 'markdown',
    'dockerfile', 'graphql', 'svelte', 'vue', 'lua', 'perl', 'r',
  ]

export let entries: { title: string; language: string; code: string }[] = []
export let selectedNote: { name: string; filePath: string }
export let initialFilterText = ''
export let selectionSuggestion: { title?: string; type?: string; text?: string; requestId?: number } | null = null
export let onRequestSelectionCheck: () => number

  const dispatch = createEventDispatcher<{
    save: typeof entries
    back: void
    insert: string
  }>()

  let localEntries = entries.map((e) => ({ ...e }))
  let copiedIndex: number | null = null
  let openMenuIndex: number | null = null
  let modalMode: 'add' | 'edit' | null = null
  let modalTitle = ''
  let modalLanguage = 'text'
  let modalCode = ''
  let modalTitleInput: HTMLInputElement
  let editingIndex: number | null = null
  let deletePrompt: { index: number; title: string; code: string } | null = null
  let deleteCodeInput = ''
  let sortDirection: 'asc' | 'desc' | null = null
  let _isSorting = false
  let filterText = ''
let lastAppliedInitialFilter = ''
let entriesContainerElem: HTMLDivElement
let filledFromSuggestion = false
let activeSelectionRequestId = 0

$: if (initialFilterText !== lastAppliedInitialFilter) {
  filterText = initialFilterText
  lastAppliedInitialFilter = initialFilterText
}

$: normalizedFilterText = filterText.trim().toLowerCase()

$: filteredEntries = sortDirection !== null
    ? [...localEntries].sort((a, b) => {
        const cmp = a.title.localeCompare(b.title)
        return sortDirection === 'asc' ? cmp : -cmp
      }).filter(e =>
        !normalizedFilterText || [e.title, e.language, e.code].some(value => value.toLowerCase().includes(normalizedFilterText))
      )
    : localEntries.filter(e =>
        !normalizedFilterText || [e.title, e.language, e.code].some(value => value.toLowerCase().includes(normalizedFilterText))
      )

$: if (entries !== localEntries) {
  localEntries = entries.map((e) => ({ ...e }))
}

$: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && modalMode === 'add' && !filledFromSuggestion) {
  filledFromSuggestion = true
  const trimmed = selectionSuggestion.text.trim()
  let jsonHandled = false
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const obj = Array.isArray(parsed) ? parsed[0] : parsed
      if (obj && typeof obj === 'object') {
        modalTitle = obj.title || obj.name || ''
        modalLanguage = obj.language || obj.lang || 'text'
        modalCode = obj.code || obj.snippet || ''
        jsonHandled = true
      }
    } catch { /* fall through */ }
  }
  if (!jsonHandled) {
    const cleaned = trimmed.replace(/^[\{\[]\s*/, '').replace(/\s*[\}\]]$/, '').trim()
    const codeBlock = cleaned.match(/```(\w*)\n([\s\S]*?)```/)
    if (codeBlock) {
      if (codeBlock[1]) modalLanguage = codeBlock[1]
      modalCode = codeBlock[2].trim()
    }
    const lines = cleaned.split('\n')
    for (const line of lines) {
      const t = line.trim().replace(/,$/, '')
      const idx = t.indexOf(':')
      if (idx > 0) {
        const key = t.slice(0, idx).trim().toLowerCase().replace(/^["']|["']$/g, '')
        const value = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        if ((key === 'title' || key === 'name') && !modalTitle) modalTitle = value
        if ((key === 'language' || key === 'lang') && !modalLanguage) modalLanguage = value
        if ((key === 'code' || key === 'snippet') && !modalCode) modalCode = value
      }
    }
    if (!modalTitle) modalTitle = (modalCode || cleaned).split('\n')[0]?.slice(0, 60) || 'Snippet'
  }
}

  function toggleSort() {
    if (sortDirection === 'asc') {
      sortDirection = 'desc'
    } else {
      sortDirection = 'asc'
    }
  }

  $: if (!_isSorting && sortDirection !== null) {
    _isSorting = true
    localEntries = [...localEntries].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title)
      return sortDirection === 'asc' ? cmp : -cmp
    })
    saveEntries()
    _isSorting = false
  }

  async function openAddModal() {
    activeSelectionRequestId = 0
    modalMode = 'add'
    activeSelectionRequestId = onRequestSelectionCheck()
    filledFromSuggestion = false
    modalTitle = ''
    modalLanguage = 'text'
    modalCode = ''
    await tick()
    modalTitleInput?.focus()
  }

  function openEditModal(index: number) {
    modalMode = 'edit'
    editingIndex = index
    modalTitle = localEntries[index].title
    modalLanguage = localEntries[index].language
    modalCode = localEntries[index].code
  }

  function saveModal() {
    if (!modalTitle.trim() || !modalCode.trim()) return
    if (modalMode === 'add') {
      localEntries = [...localEntries, { title: modalTitle.trim(), language: modalLanguage, code: modalCode }]
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else if (editingIndex !== null) {
      localEntries[editingIndex] = { title: modalTitle.trim(), language: modalLanguage, code: modalCode }
      localEntries = localEntries
    }
    cancelModal()
    saveEntries()
  }

  function cancelModal() {
    modalMode = null
    editingIndex = null
    modalTitle = ''
    modalLanguage = 'text'
    modalCode = ''
    activeSelectionRequestId = 0
    filledFromSuggestion = false
  }

  function deleteEntry(index: number) {
    if (editingIndex === index) {
      cancelModal()
    }
    localEntries = localEntries.filter((_, i) => i !== index)
    saveEntries()
  }

  function generateDeleteCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''

    for (let i = 0; i < 4; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }

    return code
  }

  function requestDeleteEntry(index: number) {
    openMenuIndex = null
    deletePrompt = {
      index,
      title: localEntries[index].title,
      code: generateDeleteCode(),
    }
    deleteCodeInput = ''
  }

  function cancelDeletePrompt() {
    deletePrompt = null
    deleteCodeInput = ''
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return
    if (deleteCodeInput.trim().toUpperCase() !== deletePrompt.code) return

    const index = deletePrompt.index
    cancelDeletePrompt()
    deleteEntry(index)
  }

  function saveEntries() {
    dispatch('save', localEntries)
  }

  function copyCode(index: number) {
    navigator.clipboard.writeText(localEntries[index].code)
    copiedIndex = index
    setTimeout(() => (copiedIndex = null), 1500)
  }

  function insertCode(index: number) {
    dispatch('insert', localEntries[index].code)
  }

  function openEntry(index: number) {
    openEditModal(index)
  }

  function toggleEntryMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index
  }

  function editFromMenu(index: number) {
    openMenuIndex = null
    openEditModal(index)
  }

  function deleteFromMenu(index: number) {
    requestDeleteEntry(index)
  }

  function handleEntryKeydown(event: KeyboardEvent, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openEntry(index)
    }
  }

  function closeEntryMenu() {
    openMenuIndex = null
  }
</script>

<div class="snippet-editor">
  <div class="editor-header">
    <button class="icon-btn" on:click={() => dispatch('back')} title="Back"><span class="anemona icon-arrow-back"></span></button>
    <span class="note-title">{selectedNote.name}</span>
    <button class="icon-btn primary-btn" on:click={openAddModal} title="Add snippet"><span class="anemona icon-plus"></span></button>
  </div>

  <div class="entries" bind:this={entriesContainerElem}>
    {#if localEntries.length > 0}
    <div class="editor-toolbar">
      <div class="search-field">
        <span class="search-icon anemona icon-search-alt"></span>
        <input
          class="field toolbar-search"
          type="text"
          placeholder="Filter snippets..."
          bind:value={filterText}
        />
      </div>
      <button
        class="icon-btn sort-btn"
        on:click={toggleSort}
        title={sortDirection === 'asc' ? "Sort Descending" : "Sort Ascending"}
      ><span
          class={`anemona ${sortDirection === 'asc' ? 'icon-sort-a-z' : 'icon-sort-z-a'}`}
        ></span></button>
    </div>
    {/if}
    {#each filteredEntries as entry, i}
      <div class="entry">
        <div class="entry-row">
          <div class="entry-toolbar">
            <span class="entry-title">{entry.title}</span>
            <div class="entry-toolbar-actions">
              <span class="lang-badge">{entry.language}</span>
              <div class="menu-wrap" class:menu-open={openMenuIndex === i}>
                <button
                  class="icon-btn menu-btn"
                  on:click|stopPropagation={() => toggleEntryMenu(i)}
                  title="Entry options"
                >
                  <span class="anemona icon-dots-vertical"></span>
                </button>
                {#if openMenuIndex === i}
                  <div class="menu-popover command-menu" use:smartPopover={{ open: openMenuIndex === i, onClose: closeEntryMenu }}>
                    <button class="menu-item" on:click|stopPropagation={() => editFromMenu(i)}>
                      <span class="anemona icon-edit-alt"></span>
                      <span>Rename</span>
                    </button>
                    <button class="menu-item danger" on:click|stopPropagation={() => deleteFromMenu(i)}>
                      <span class="anemona icon-trash-alt"></span>
                      <span>Delete</span>
                    </button>
                  </div>
                {/if}
              </div>
              <button
                class="icon-btn copy-btn"
                on:click|stopPropagation={() => copyCode(i)}
                title="Copy code"
              >
                <span class={`anemona ${copiedIndex === i ? 'icon-check' : 'icon-copy'}`}></span>
              </button>
              <button
                class="icon-btn insert-btn"
                on:click|stopPropagation={() => insertCode(i)}
                title="Insert into editor"
              >
                <span class="anemona icon-code-insert"></span>
              </button>
            </div>
          </div>
          <div
            class="entry-info"
            on:click={() => openEntry(i)}
            on:keydown={(event) => handleEntryKeydown(event, i)}
            role="button"
            tabindex="0"
          >
            <pre class="entry-code">{entry.code}</pre>
          </div>
        </div>
      </div>
    {/each}
    <button class="add-entry-btn" on:click={openAddModal}><span class="anemona icon-plus"></span> Add snippet</button>
  </div>
</div>

{#if deletePrompt}
  <button class="delete-modal-backdrop" on:click={cancelDeletePrompt} aria-label="Close snippet delete confirmation"></button>
  <div class="delete-modal">
    <h3>Delete snippet</h3>
    <p>Confirm deletion of <strong>{deletePrompt.title}</strong> by typing <strong>{deletePrompt.code}</strong></p>
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

{#if modalMode}
  <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"></button>
  <div class="add-modal">
    <h3>{modalMode === 'add' ? 'Add snippet' : 'Edit snippet'}</h3>
    <input class="modal-field" type="text" placeholder="Title" bind:this={modalTitleInput} bind:value={modalTitle} />
    <select class="modal-field lang-select" bind:value={modalLanguage}>
      {#each SUPPORTED_LANGUAGES as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>
    <textarea class="modal-field code-modal-field" placeholder="Code" bind:value={modalCode} rows="6"></textarea>
    <div class="modal-actions">
      <button class="btn" on:click={cancelModal}>Cancel</button>
      <button class="btn primary" on:click={saveModal}>{modalMode === 'add' ? 'Add' : 'Save'}</button>
    </div>
  </div>
{/if}

<style>
  .snippet-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.26rem;
    box-sizing: border-box;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.26rem 0.32rem;
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--accent-color) 14%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .note-title {
    flex: 1;
    font-size: var(--ui-font-title);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.82em;
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    opacity: 0.92;
  }

  .icon-btn:hover {
    opacity: 1;
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    border-color: transparent;
  }

  .icon-btn:focus-visible {
    outline: 1px solid color-mix(in srgb, var(--accent-color) 45%, transparent);
    outline-offset: 1px;
  }

  .primary-btn {
    color: color-mix(in srgb, var(--accent-color) 86%, white 14%);
    border-color: transparent;
    background: transparent;
  }

  .primary-btn:hover {
    color: white;
    background: color-mix(in srgb, var(--accent-color) 14%, transparent);
    border-color: transparent;
  }

  .primary-btn span {
    font-size: 0.88rem;
    font-weight: 500;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin-top: 0.22rem;
    margin-bottom: 0.18rem;
  }

  .search-field {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: var(--ui-search-icon-left);
    transform: translateY(-50%);
    font-size: 0.78em;
    color: var(--vscode-descriptionForeground);
    pointer-events: none;
    z-index: 1;
  }

  .toolbar-search {
    width: 100%;
    min-width: 0;
    height: var(--ui-control-height-sm);
    box-sizing: border-box;
    color: var(--vscode-sideBarTitle-foreground);
    padding-left: var(--ui-search-input-pad-left);
    padding-right: 0.46rem;
    border-radius: 6px;
    font-size: var(--ui-font-control);
    line-height: 1;
    border: 1px solid var(--ui-border-strong);
    background: var(--vscode-input-background);
    box-shadow: none;
  }

  .toolbar-search:focus {
    border-color: var(--ui-border-strong);
    outline: none;
    box-shadow: none;
  }

  .sort-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--ui-toolbar-btn-size);
    height: var(--ui-toolbar-btn-size);
    font-size: 0.8em;
    border-color: color-mix(
      in srgb,
      var(--accent-color) 16%,
      var(--ui-border)
    );
    background: color-mix(
      in srgb,
      var(--accent-color) 6%,
      var(--vscode-sideBar-background)
    );
    flex-shrink: 0;
  }

  .sort-btn :global(.anemona) {
    line-height: 1;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    padding: 0.18rem 0 0;
  }

  .entry {
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    margin-bottom: 0.18rem;
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .entry:last-child { border-bottom: none; }

  .entry-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.16rem;
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
  }

  .entry-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.3rem;
  }

  .entry-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.18rem;
    flex-shrink: 0;
  }

  .entry-info {
    flex: 1;
    cursor: pointer;
    overflow: hidden;
  }

  .entry-info:hover { opacity: 0.8; }

  .entry-title {
    font-size: var(--ui-font-entry);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lang-badge {
    font-size: 0.62rem;
    font-weight: 500;
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    padding: 0.08rem 0.3rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .entry-code {
    display: block;
    font-size: var(--ui-font-sm);
    color: var(--vscode-textPreformat-foreground);
    background: color-mix(in srgb, var(--accent-color) 5%, var(--vscode-sideBar-background));
    padding: 0.24rem 0.34rem;
    border-radius: 5px;
    margin-top: 0.12rem;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: var(--vscode-editor-font-family, monospace);
    line-height: 1.25;
    min-height: 1.55rem;
    max-height: 8rem;
    overflow-y: auto;
  }

  .copy-btn { font-size: 0.8em; flex-shrink: 0; }

  .insert-btn { font-size: 0.8em; flex-shrink: 0; }

  .menu-wrap {
    position: relative;
    z-index: 0;
  }

  .menu-wrap.menu-open {
    z-index: 20;
  }

  .menu-popover {
    position: absolute;
    top: calc(100% + 0.16rem);
    bottom: auto;
    left: auto;
    right: 0;
    min-width: 7.2rem;
    max-width: min(var(--popover-max-width, 20rem), calc(100vw - 1rem));
    max-height: var(--popover-max-height, 24rem);
    overflow-y: auto;
    background: color-mix(in srgb, var(--accent-color) 7%, var(--vscode-editor-background));
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    box-shadow: var(--ui-shadow);
    padding: 0.14rem;
    z-index: 12;
  }

  :global(.menu-popover[data-vertical='up']) {
    top: auto;
    bottom: calc(100% + 0.16rem);
  }

  :global(.menu-popover[data-horizontal='left']) {
    left: 0;
    right: auto;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.42rem;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    border-radius: var(--ui-radius-sm);
    padding: var(--ui-menu-pad-y) var(--ui-menu-pad-x);
    cursor: pointer;
    font-size: var(--ui-menu-font);
    text-align: left;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  }

  .menu-item.danger {
    color: #e87070;
  }

  .field {
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-input-background));
    color: var(--vscode-input-foreground);
    border: 1px solid color-mix(in srgb, var(--accent-color) 16%, var(--ui-border-strong));
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    box-sizing: border-box;
    padding: var(--ui-control-pad-y) var(--ui-control-pad-x);
    font-size: var(--ui-font-control);
    outline: none;
    font-family: inherit;
  }

  .field:focus {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--vscode-focusBorder));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .search-field .toolbar-search {
    padding-left: var(--ui-search-input-pad-left);
    padding-right: 0.46rem;
  }

  .lang-select {
    appearance: auto;
    cursor: pointer;
  }

  .btn {
    min-height: var(--ui-control-height-sm);
    padding: 0.22rem 0.46rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-control);
    font-weight: 400;
  }

  .btn.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  .btn.primary:hover { background: var(--vscode-button-hoverBackground); }

  .btn.small { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn.small:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .btn.danger { background: #c0392b; color: #fff; }
  .btn.danger:hover { background: #e74c3c; }

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
    font-weight: 500;
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
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--ui-font-control);
  }

  .delete-code-input:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 30;
  }

  .add-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(400px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
  }

  .add-modal h3 {
    margin: 0 0 0.55rem;
    font-size: 0.84rem;
    font-weight: 500;
  }

  .modal-field {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    font-size: var(--ui-font-control);
    font-family: inherit;
    margin-bottom: 0.55rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .code-modal-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: vertical;
    min-height: 5rem;
  }

  .add-entry-btn {
    width: 100%;
    background: color-mix(in srgb, var(--accent-color) 5%, var(--vscode-editor-background));
    border: 1px dashed var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    min-height: var(--ui-control-height);
    padding: 0.26rem 0.38rem;
    font-size: var(--ui-font-control);
    font-weight: 400;
    margin-bottom: 0.18rem;
    opacity: 0.84;
    position: sticky;
    bottom: 0;
    z-index: 1;
  }

  .add-entry-btn.no-entries {
    position: static;
  }

  .add-entry-btn:hover {
    opacity: 1;
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }
</style>
