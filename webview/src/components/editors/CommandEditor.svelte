<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../../i18n'
  import EditorHeader from '../layout/EditorHeader.svelte'
  import EntryTitleBar from '../layout/EntryTitleBar.svelte'
  import SearchToolbar from '../ui/SearchToolbar.svelte'
  import DeleteConfirmModal from '../ui/DeleteConfirmModal.svelte'
  import FormModal from '../ui/FormModal.svelte'
  import { COPY_FEEDBACK_MS, copyText } from '../../utils/clipboard'
  import { appendEntry, applyInitialFilter, cloneEntries, removeEntry, replaceEntry, shouldSyncEntries } from '../../utils/editorState'
  import { parseCommandSuggestion } from '../../utils/selectionParser'
  import { nextSortDirection, sortAndFilterEntries, type SortDirection } from '../../utils/sortUtils'

export let entries: { title: string; command: string }[] = []
export let selectedNote: { name: string; filePath: string }
export let initialFilterText = ''
export let selectionSuggestion: { title?: string; type?: string; text?: string; requestId?: number } | null = null
export let onRequestSelectionCheck: () => number
export let onRenameNote: (() => void) | null = null
export let onMoveNote: (() => void) | null = null
export let onImportNote: (() => void) | null = null
export let onExportNote: (() => void) | null = null
export let onDeleteNote: (() => void) | null = null



  const dispatch = createEventDispatcher<{
    save: typeof entries
    back: void
    insert: string
  }>()

  let localEntries = cloneEntries(entries)
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
  let filterText = ''
  let lastAppliedInitialFilter = ''
  let entriesContainerElem: HTMLDivElement
  let filledFromSuggestion = false
  let activeSelectionRequestId = 0

$: if (initialFilterText !== lastAppliedInitialFilter) {
  const next = applyInitialFilter(filterText, initialFilterText, lastAppliedInitialFilter)
  filterText = next.filterText
  lastAppliedInitialFilter = next.lastAppliedInitialFilter
}

  $: filteredEntries = sortAndFilterEntries(
    localEntries,
    sortDirection,
    filterText,
    (entry) => [entry.title, entry.command],
  )

let _prevEntries = entries
$: if (entries !== localEntries && shouldSyncEntries(entries, _prevEntries)) {
  _prevEntries = entries
  localEntries = cloneEntries(entries)
}

$: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && cmdModalMode === 'add' && !filledFromSuggestion) {
  filledFromSuggestion = true
  const parsed = parseCommandSuggestion(selectionSuggestion.text)
  modalTitle = parsed.title
  modalCommand = parsed.command
}

  function toggleSort() {
    sortDirection = nextSortDirection(sortDirection)
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
      localEntries = appendEntry(localEntries, { title: modalTitle.trim(), command: modalCommand.trim() })
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else if (editingCmdIndex !== null) {
      localEntries = replaceEntry(localEntries, editingCmdIndex, { title: modalTitle.trim(), command: modalCommand.trim() })
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
    localEntries = removeEntry(localEntries, index)
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

  async function copyCommand(index: number) {
    if (!(await copyText(localEntries[index].command))) return
    copiedIndex = index
    setTimeout(() => (copiedIndex = null), COPY_FEEDBACK_MS)
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

<div class="command-editor editor-shell">
  <EditorHeader
    noteName={selectedNote.name}
    showFileMenu={true}
    onRename={onRenameNote}
    onMove={onMoveNote}
    onImport={onImportNote}
    onExport={onExportNote}
    onDelete={onDeleteNote}
    on:back={() => dispatch('back')}
  >
    <div class="command-editor__header-actions">
      <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('commandEditor.addCommand')}>
        <span class="anemona icon-plus"></span>
      </button>
    </div>
  </EditorHeader>

  <div class="command-editor__entries entry-list" bind:this={entriesContainerElem}>
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
      <div class="command-editor__entry entry-list__item">
        <div class="entry-list__row">
          <EntryTitleBar
            title={entry.title}
            menuOpen={openMenuIndex === realIndex}
            menuTitle={$t('commandEditor.entryOptions')}
            editLabel={$t('commandEditor.rename')}
            deleteLabel={$t('commandEditor.delete')}
            on:toggleMenu={() => toggleEntryMenu(realIndex)}
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
            class="command-editor__entry-info entry-list__info"
            on:click={() => openEntry(realIndex)}
            on:keydown={(event) => handleEntryKeydown(event, realIndex)}
            role="button"
            tabindex="0"
          >
            <code class="command-editor__preview entry-list__preview">{entry.command}</code>
          </div>
        </div>
      </div>
    {/each}
    <button class="command-editor__add-entry add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddModal}><span class="anemona icon-plus"></span> {$t('commandEditor.addCommand')}</button>
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
  <FormModal
    modalClass="add-modal"
    title={cmdModalMode === 'add' ? $t('commandEditor.addCommandTitle') : $t('commandEditor.editCommandTitle')}
    on:close={cancelModal}
  >
    <input class="modal-field" class:field-error={titleError} type="text" placeholder={$t('commandEditor.titlePlaceholder')} bind:this={modalTitleInput} bind:value={modalTitle} />
    <textarea class="modal-field command-editor__modal-field" class:field-error={cmdError} placeholder={$t('commandEditor.commandPlaceholder')} bind:value={modalCommand} rows="3"></textarea>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelModal}>{$t('commandEditor.cancel')}</button>
      <button class="btn primary" on:click={saveModal}>{cmdModalMode === 'add' ? $t('commandEditor.add') : $t('commandEditor.save')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

<style>
  .command-editor__modal-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: none;
  }

</style>
