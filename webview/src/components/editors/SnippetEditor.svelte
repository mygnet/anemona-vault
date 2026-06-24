<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../../i18n'
  import type { SortDirection } from '../../utils/sortUtils'
  import EditorHeader from '../layout/EditorHeader.svelte'
  import EntryTitleBar from '../layout/EntryTitleBar.svelte'
  import SearchToolbar from '../ui/SearchToolbar.svelte'
  import DeleteConfirmModal from '../ui/DeleteConfirmModal.svelte'
  import FormModal from '../ui/FormModal.svelte'
  import { COPY_FEEDBACK_MS, copyText } from '../../utils/clipboard'
  import { appendEntry, applyInitialFilter, cloneEntries, removeEntry, replaceEntry, shouldSyncEntries } from '../../utils/editorState'
  import { parseSnippetSuggestion } from '../../utils/selectionParser'
  import { nextSortDirection, sortAndFilterEntries } from '../../utils/sortUtils'

  const SUPPORTED_LANGUAGES = [
    'text', 'typescript', 'javascript', 'python', 'rust', 'go', 'java', 'kotlin',
    'swift', 'ruby', 'php', 'c', 'cpp', 'csharp', 'sql', 'bash', 'zsh',
    'yaml', 'json', 'xml', 'html', 'css', 'scss', 'less', 'markdown',
    'dockerfile', 'graphql', 'svelte', 'vue', 'lua', 'perl', 'r',
  ]

export let entries: { title: string; language: string; code: string }[] = []
export let selectedNote: { name: string; filePath: string }
export let initialFilterText = ''
export let selectionSuggestion: { title?: string; type?: string; text?: string; languageId?: string; requestId?: number } | null = null

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
  let modalMode: 'add' | 'edit' | null = null
  let modalTitle = ''
  let modalLanguage = 'text'
  let modalCode = ''
  let titleError = false
  let codeError = false
  let modalTitleInput: HTMLInputElement
  let editingIndex: number | null = null
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
    (entry) => [entry.title, entry.language, entry.code],
  )

let _prevEntries = entries
$: if (entries !== localEntries && shouldSyncEntries(entries, _prevEntries)) {
  _prevEntries = entries
  localEntries = cloneEntries(entries)
}

$: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && modalMode === 'add' && !filledFromSuggestion) {
  filledFromSuggestion = true
  const parsed = parseSnippetSuggestion(selectionSuggestion.text, selectionSuggestion.languageId)
  modalTitle = parsed.title
  modalLanguage = parsed.language
  modalCode = parsed.code
}

  function toggleSort() {
    sortDirection = nextSortDirection(sortDirection)
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
    const titleOk = modalTitle.trim()
    const codeOk = modalCode.trim()
    titleError = !titleOk
    codeError = !codeOk
    if (!titleOk || !codeOk) return
    if (modalMode === 'add') {
      localEntries = appendEntry(localEntries, { title: modalTitle.trim(), language: modalLanguage, code: modalCode })
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else if (editingIndex !== null) {
      localEntries = replaceEntry(localEntries, editingIndex, { title: modalTitle.trim(), language: modalLanguage, code: modalCode })
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
    titleError = false
    codeError = false
    activeSelectionRequestId = 0
    filledFromSuggestion = false
  }

  function requestDeleteEntry(index: number) {
    openMenuIndex = null
    deletePrompt = { index, title: localEntries[index].title }
  }

  function cancelDeletePrompt() {
    deletePrompt = null
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return
    const index = deletePrompt.index
    localEntries = removeEntry(localEntries, index)
    saveEntries()
    deletePrompt = null
  }

  function saveEntries() {
    dispatch('save', localEntries)
  }

  async function copyCode(index: number) {
    if (!(await copyText(localEntries[index].code))) return
    copiedIndex = index
    setTimeout(() => (copiedIndex = null), COPY_FEEDBACK_MS)
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

<div class="snippet-editor editor-shell">
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
    <div class="snippet-editor__header-actions">
      <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('snippetEditor.addSnippet')}>
        <span class="anemona icon-plus"></span>
      </button>
    </div>
  </EditorHeader>

  <div class="snippet-editor__entries entry-list" bind:this={entriesContainerElem}>
    <SearchToolbar
      value={filterText}
      placeholder={$t('snippetEditor.filterPlaceholder')}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t('snippetEditor.sortAscending')}
      sortTitleDesc={$t('snippetEditor.sortDescending')}
      on:input={(e) => { filterText = e.detail }}
      on:toggleSort={toggleSort}
    />
    {#each filteredEntries as entry, i}
      {@const realIndex = localEntries.indexOf(entry)}
      <div class="snippet-editor__entry entry-list__item">
        <div class="entry-list__row">
          <EntryTitleBar
            title={entry.title}
            menuOpen={openMenuIndex === realIndex}
            menuTitle={$t('snippetEditor.entryOptions')}
            editLabel={$t('snippetEditor.rename')}
            deleteLabel={$t('snippetEditor.delete')}
            on:toggleMenu={() => toggleEntryMenu(realIndex)}
            on:closeMenu={closeEntryMenu}
            on:edit={() => editFromMenu(realIndex)}
            on:delete={() => deleteFromMenu(realIndex)}
          >
              <span slot="meta" class="ui-badge info uppercase">{entry.language}</span>
              <button
                class="icon-action"
                on:click|stopPropagation={() => copyCode(realIndex)}
                title={$t('snippetEditor.copyCode')}
              >
                <span class={`anemona ${copiedIndex === realIndex ? 'icon-check' : 'icon-copy'}`}></span>
              </button>
              <button
                class="icon-action"
                on:click|stopPropagation={() => insertCode(realIndex)}
                title={$t('snippetEditor.insertIntoEditor')}
              >
                <span class="anemona icon-code-insert"></span>
              </button>
          </EntryTitleBar>
          <div
            class="snippet-editor__entry-info entry-list__info"
            on:click={() => openEntry(realIndex)}
            on:keydown={(event) => handleEntryKeydown(event, realIndex)}
            role="button"
            tabindex="0"
          >
            <pre class="snippet-editor__preview entry-list__preview entry-list__preview--scrollable">{entry.code}</pre>
          </div>
        </div>
      </div>
    {/each}
    <button class="snippet-editor__add-entry add-entry-btn" on:click={openAddModal}><span class="anemona icon-plus"></span> {$t('snippetEditor.addSnippet')}</button>
  </div>
</div>

<DeleteConfirmModal
    show={deletePrompt !== null}
    title={$t('snippetEditor.deleteSnippetTitle')}
    itemName={deletePrompt ? deletePrompt.title : ''}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />

{#if modalMode}
  <FormModal
    modalClass="add-modal"
    title={modalMode === 'add' ? $t('snippetEditor.addSnippetTitle') : $t('snippetEditor.editSnippetTitle')}
    on:close={cancelModal}
  >
    <input class="modal-field" class:field-error={titleError} type="text" placeholder={$t('snippetEditor.titlePlaceholder')} bind:this={modalTitleInput} bind:value={modalTitle} />
    <select class="modal-field snippet-editor__language-select" bind:value={modalLanguage}>
      {#each SUPPORTED_LANGUAGES as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>
    <textarea class="modal-field snippet-editor__code-field" class:field-error={codeError} placeholder={$t('snippetEditor.codePlaceholder')} bind:value={modalCode} rows="6"></textarea>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelModal}>{$t('snippetEditor.cancel')}</button>
      <button class="btn primary" on:click={saveModal}>{modalMode === 'add' ? $t('snippetEditor.add') : $t('snippetEditor.save')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

<style>
  .snippet-editor__language-select {
    appearance: auto;
    cursor: pointer;
  }

  .snippet-editor__code-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: vertical;
    min-height: 5rem;
  }

</style>
