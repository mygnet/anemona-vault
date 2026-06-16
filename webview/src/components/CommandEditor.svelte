<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { smartPopover } from '../utils/smartPopover'

export let entries: { title: string; command: string }[] = []
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
  let cmdModalMode: 'add' | 'edit' | null = null
  let modalTitle = ''
  let modalCommand = ''
  let modalTitleInput: HTMLInputElement
  let editingCmdIndex: number | null = null
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
        !normalizedFilterText || [e.title, e.command].some(value => value.toLowerCase().includes(normalizedFilterText))
      )
    : localEntries.filter(e =>
        !normalizedFilterText || [e.title, e.command].some(value => value.toLowerCase().includes(normalizedFilterText))
      )

$: if (entries !== localEntries) {
  localEntries = entries.map((e) => ({ ...e }))
}

$: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && cmdModalMode === 'add' && !filledFromSuggestion) {
  filledFromSuggestion = true
  const trimmed = selectionSuggestion.text.trim()
  let jsonHandled = false
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const obj = Array.isArray(parsed) ? parsed[0] : parsed
      if (obj && typeof obj === 'object') {
        modalTitle = obj.title || obj.name || ''
        modalCommand = obj.command || obj.cmd || obj.code || obj.script || ''
        jsonHandled = true
      }
    } catch { /* fall through */ }
  }
  if (!jsonHandled) {
    const cleaned = trimmed.replace(/^[\{\[]\s*/, '').replace(/\s*[\}\]]$/, '').trim()
    const lines = cleaned.split('\n').filter((l: string) => l.trim())
    let title = '', cmd = ''
    for (const line of lines) {
      const t = line.trim().replace(/,$/, '')
      const idx = t.indexOf(':')
      if (idx > 0) {
        const key = t.slice(0, idx).trim().toLowerCase().replace(/^["']|["']$/g, '')
        const value = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        if ((key === 'title' || key === 'name') && !title) title = value
        if ((key === 'command' || key === 'cmd' || key === 'code' || key === 'script') && !cmd) cmd = value
      }
    }
    if (!title) title = lines[0]?.trim().slice(0, 60) || ''
    if (!cmd) cmd = cleaned
    modalTitle = title
    modalCommand = cmd
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
    cmdModalMode = 'add'
    activeSelectionRequestId = onRequestSelectionCheck()
    filledFromSuggestion = false
    modalTitle = ''
    modalCommand = ''
    await tick()
    modalTitleInput?.focus()
  }

  function openEditModal(index: number) {
    cmdModalMode = 'edit'
    editingCmdIndex = index
    modalTitle = localEntries[index].title
    modalCommand = localEntries[index].command
  }

  function saveModal() {
    if (!modalTitle.trim() || !modalCommand.trim()) return
    if (cmdModalMode === 'add') {
      localEntries = [...localEntries, { title: modalTitle.trim(), command: modalCommand.trim() }]
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else if (editingCmdIndex !== null) {
      localEntries[editingCmdIndex] = { title: modalTitle.trim(), command: modalCommand.trim() }
      localEntries = localEntries
    }
    cancelModal()
    saveEntries()
  }

  function cancelModal() {
    cmdModalMode = null
    editingCmdIndex = null
    modalTitle = ''
    modalCommand = ''
    activeSelectionRequestId = 0
    filledFromSuggestion = false
  }

  function deleteEntry(index: number) {
    if (editingCmdIndex === index) {
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

  function copyCommand(index: number) {
    navigator.clipboard.writeText(localEntries[index].command)
    copiedIndex = index
    setTimeout(() => (copiedIndex = null), 1500)
  }

  function insertCommand(index: number) {
    dispatch('insert', localEntries[index].command)
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

<div class="cmd-editor">
  <div class="editor-header">
    <button class="icon-btn" on:click={() => dispatch('back')} title="Back"><span class="anemona icon-arrow-back"></span></button>
    <span class="note-title">{selectedNote.name}</span>
    <button class="icon-btn primary-btn" on:click={openAddModal} title="Add command"><span class="anemona icon-plus"></span></button>
  </div>

  <div class="entries" bind:this={entriesContainerElem}>
    {#if localEntries.length > 0}
    <div class="editor-toolbar">
      <div class="search-field">
        <span class="search-icon anemona icon-search-alt"></span>
        <input
          class="field toolbar-search"
          type="text"
          placeholder="Filter commands..."
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
                on:click|stopPropagation={() => copyCommand(i)}
                title="Copy command"
              >
                <span class={`anemona ${copiedIndex === i ? 'icon-check' : 'icon-copy'}`}></span>
              </button>
              <button
                class="icon-btn insert-btn"
                on:click|stopPropagation={() => insertCommand(i)}
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
            <code class="entry-command">{entry.command}</code>
          </div>
        </div>
      </div>
    {/each}
    <button class="add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddModal}><span class="anemona icon-plus"></span> Add command</button>
  </div>
</div>

{#if deletePrompt}
  <button class="delete-modal-backdrop" on:click={cancelDeletePrompt} aria-label="Close command delete confirmation"></button>
  <div class="delete-modal">
    <h3>Delete command</h3>
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

{#if cmdModalMode}
  <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"></button>
  <div class="add-modal">
    <h3>{cmdModalMode === 'add' ? 'Add command' : 'Edit command'}</h3>
    <input class="modal-field" type="text" placeholder="Title" bind:this={modalTitleInput} bind:value={modalTitle} />
    <textarea class="modal-field cmd-modal-field" placeholder="Command" bind:value={modalCommand} rows="3"></textarea>
    <div class="modal-actions">
      <button class="btn" on:click={cancelModal}>Cancel</button>
      <button class="btn primary" on:click={saveModal}>{cmdModalMode === 'add' ? 'Add' : 'Save'}</button>
    </div>
  </div>
{/if}

<style>
  .cmd-editor {
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

  .entry-command {
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
    width: min(360px, calc(100vw - 2rem));
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

  .cmd-modal-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: none;
  }

  .add-entry-btn {
    width: 100%;
    position: sticky;
    bottom: 0;
    z-index: 1;
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
  }

  .add-entry-btn:hover {
    opacity: 1;
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .add-entry-btn.no-entries {
    position: static;
  }
</style>
