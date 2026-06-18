<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../i18n'
  import EditorHeader from '../lib/EditorHeader.svelte'
  import EntryTitleBar from '../lib/EntryTitleBar.svelte'
  import SearchToolbar from '../lib/SearchToolbar.svelte'
  import DeleteConfirmModal from '../lib/DeleteConfirmModal.svelte'
  import type { SortDirection } from '../lib/sortUtils'

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
  let titleError = false
  let cmdError = false
  let modalTitleInput: HTMLInputElement
  let editingCmdIndex: number | null = null
  let deletePrompt: { index: number; title: string } | null = null
  let sortDirection: SortDirection = null
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

let _prevEntries = entries
$: if (entries !== localEntries && entries !== _prevEntries) {
  _prevEntries = entries
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
    const titleOk = modalTitle.trim()
    const cmdOk = modalCommand.trim()
    titleError = !titleOk
    cmdError = !cmdOk
    if (!titleOk || !cmdOk) return
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
    titleError = false
    cmdError = false
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

  function requestDeleteEntry(index: number) {
    openMenuIndex = null
    deletePrompt = {
      index,
      title: localEntries[index].title,
    }
  }

  function cancelDeletePrompt() {
    deletePrompt = null
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return
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

<div class="cmd-editor editor-shell">
  <EditorHeader noteName={selectedNote.name} on:back={() => dispatch('back')}>
    <div class="header-actions">
      <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('commandEditor.addCommand')}>
        <span class="anemona icon-plus"></span>
      </button>
    </div>
  </EditorHeader>

  <div class="entries" bind:this={entriesContainerElem}>
    {#if localEntries.length > 0}
    <SearchToolbar
      value={filterText}
      placeholder={$t('commandEditor.filterPlaceholder')}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t('commandEditor.sortAscending')}
      sortTitleDesc={$t('commandEditor.sortDescending')}
      on:input={(e) => { filterText = e.detail }}
      on:toggleSort={toggleSort}
    />
    {/if}
    {#each filteredEntries as entry, i}
      {@const realIndex = localEntries.indexOf(entry)}
      <div class="entry">
        <div class="entry-row">
          <EntryTitleBar
            title={entry.title}
            menuOpen={openMenuIndex === i}
            menuTitle={$t('commandEditor.entryOptions')}
            editLabel={$t('commandEditor.rename')}
            deleteLabel={$t('commandEditor.delete')}
            on:toggleMenu={() => toggleEntryMenu(i)}
            on:closeMenu={closeEntryMenu}
            on:edit={() => editFromMenu(realIndex)}
            on:delete={() => deleteFromMenu(realIndex)}
          >
              <button
                class="icon-action"
                on:click|stopPropagation={() => copyCommand(realIndex)}
                title={$t('commandEditor.copyCommand')}
              >
                <span class={`anemona ${copiedIndex === realIndex ? 'icon-check' : 'icon-copy'}`}></span>
              </button>
              <button
                class="icon-action"
                on:click|stopPropagation={() => insertCommand(realIndex)}
                title={$t('commandEditor.insertIntoEditor')}
              >
                <span class="anemona icon-code-insert"></span>
              </button>
          </EntryTitleBar>
          <div
            class="entry-info"
            on:click={() => openEntry(realIndex)}
            on:keydown={(event) => handleEntryKeydown(event, realIndex)}
            role="button"
            tabindex="0"
          >
            <code class="entry-preview">{entry.command}</code>
          </div>
        </div>
      </div>
    {/each}
    <button class="add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddModal}><span class="anemona icon-plus"></span> {$t('commandEditor.addCommand')}</button>
  </div>
</div>

<DeleteConfirmModal
    show={deletePrompt !== null}
    title={$t('commandEditor.deleteCommandTitle')}
    itemName={deletePrompt ? deletePrompt.title : ''}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />

{#if cmdModalMode}
  <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"></button>
  <div class="add-modal">
    <h3>{cmdModalMode === 'add' ? $t('commandEditor.addCommandTitle') : $t('commandEditor.editCommandTitle')}</h3>
    <input class="modal-field" class:field-error={titleError} type="text" placeholder={$t('commandEditor.titlePlaceholder')} bind:this={modalTitleInput} bind:value={modalTitle} />
    <textarea class="modal-field cmd-modal-field" class:field-error={cmdError} placeholder={$t('commandEditor.commandPlaceholder')} bind:value={modalCommand} rows="3"></textarea>
    <div class="modal-actions">
      <button class="btn" on:click={cancelModal}>{$t('commandEditor.cancel')}</button>
      <button class="btn primary" on:click={saveModal}>{cmdModalMode === 'add' ? $t('commandEditor.add') : $t('commandEditor.save')}</button>
    </div>
  </div>
{/if}

<style>
  .cmd-modal-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: none;
  }

</style>
