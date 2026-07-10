<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../../i18n'
  import EditorHeader from '../layout/EditorHeader.svelte'
  import EntryTitleBar from '../layout/EntryTitleBar.svelte'
  import SearchToolbar from '../ui/SearchToolbar.svelte'
  import FormModal from '../ui/FormModal.svelte'
  import { COPY_FEEDBACK_MS, copyText } from '../../utils/clipboard'
  import { appendEntry, applyInitialFilter, cloneEntries, removeEntry, replaceEntry, shouldSyncEntries } from '../../utils/editorState'
  import { parseLinkSuggestion } from '../../utils/selectionParser'
  import { nextSortDirection, sortAndFilterEntries, type SortDirection } from '../../utils/sortUtils'

type LinkEntry = { title: string; url: string; description?: string; status?: string; favicon?: string; lastCheckedAt?: string }

export let entries: LinkEntry[] = []
export let selectedNote: { name: string; filePath: string }
export let initialFilterText = ''
export let selectionSuggestion: { title?: string; type?: string; text?: string; requestId?: number } | null = null
export let linkPreviewData: { url?: string; title?: string; favicon?: string; description?: string } | null = null
export let activeEntryIndex = -1
export let syncDoneId = 0
export let resumeOffset = 0
export let onRequestSelectionCheck: () => number
export let onRenameNote: (() => void) | null = null
export let onMoveNote: (() => void) | null = null
export let onImportNote: (() => void) | null = null
export let onExportNote: (() => void) | null = null
export let onDeleteNote: (() => void) | null = null

  const dispatch = createEventDispatcher<{
    save: typeof entries
    syncEntry: { entries: typeof entries; index: number }
    syncAll: { entries: typeof entries; resumeOffset: number }
    cancelSyncAll: void
    previewLink: string
    back: void
    insert: string
    openExternal: { type: string; value: string }
  }>()

  let localEntries = cloneEntries(entries)
  let copiedIndex: number | null = null
  let openMenuIndex: number | null = null
  let modalMode: 'add' | 'edit' | null = null
  let modalTitle = ''
  let modalUrl = ''
  let modalDescription = ''
  let urlError = false
  let modalUrlInput: HTMLInputElement
  let editingIndex: number | null = null
  let deletePrompt: { index: number; title: string } | null = null
  let sortDirection: SortDirection = null
  let filterText = ''
  let lastAppliedInitialFilter = ''
  let entriesContainerElem: HTMLDivElement
  let filledFromSuggestion = false
  let activeSelectionRequestId = 0
  let expanded: Set<number> = new Set()
  let syncingIndex: number | null = null
  let syncingAll = false
  let previewingUrl = false
  let lastPreviewUrl = ''
  let previewFavicon: string | null = null

$: if (initialFilterText !== lastAppliedInitialFilter) {
  const next = applyInitialFilter(filterText, initialFilterText, lastAppliedInitialFilter)
  filterText = next.filterText
  lastAppliedInitialFilter = next.lastAppliedInitialFilter
}

  $: filteredEntries = sortAndFilterEntries(
    localEntries,
    sortDirection,
    filterText,
    (entry) => [entry.title, entry.url, entry.description],
  )

let _prevEntries = entries
$: if (entries !== localEntries && shouldSyncEntries(entries, _prevEntries)) {
  _prevEntries = entries
  localEntries = cloneEntries(entries)
}

$: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && modalMode === 'add' && !filledFromSuggestion) {
  filledFromSuggestion = true
  const parsed = parseLinkSuggestion(selectionSuggestion.text)
  modalTitle = parsed.title
  modalUrl = parsed.url
}

$: if (linkPreviewData && previewingUrl && linkPreviewData.url === lastPreviewUrl) {
  if (modalMode) {
    if (linkPreviewData.title) modalTitle = linkPreviewData.title
    if (linkPreviewData.favicon) previewFavicon = linkPreviewData.favicon
    if (linkPreviewData.description) modalDescription = linkPreviewData.description
    previewingUrl = false
  }
}

$: if (syncDoneId) {
  syncingAll = false
  syncingIndex = null
}

$: if (activeEntryIndex >= 0 && entriesContainerElem) {
  const items = entriesContainerElem.querySelectorAll('.link-editor__entry')
  const target = items[activeEntryIndex] as HTMLElement | undefined
  if (target) {
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
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
    modalUrl = ''
    modalDescription = ''
    previewingUrl = false
    lastPreviewUrl = ''
    previewFavicon = null
    filledFromSuggestion = false
    modalUrlInput?.focus()
  }

  function openEditModal(index: number) {
    modalMode = 'edit'
    editingIndex = index
    modalTitle = localEntries[index].title
    modalUrl = localEntries[index].url
    modalDescription = localEntries[index].description || ''
    previewingUrl = false
    lastPreviewUrl = ''
    previewFavicon = null
  }

  function saveModal() {
    const urlOk = modalUrl.trim()
    urlError = !urlOk
    if (!urlOk) return
    const entry: LinkEntry = {
      title: modalTitle.trim(),
      url: modalUrl.trim(),
      ...(modalDescription.trim() ? { description: modalDescription.trim() } : {}),
      ...(previewFavicon ? { favicon: previewFavicon } : {}),
      ...(previewFavicon ? { status: 'ok' } : {}),
    }
    if (modalMode === 'add') {
      localEntries = appendEntry(localEntries, entry)
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else if (editingIndex !== null) {
      localEntries = replaceEntry(localEntries, editingIndex, entry)
    }
    cancelModal()
    saveEntries()
  }

  function cancelModal() {
    modalMode = null
    editingIndex = null
    modalTitle = ''
    modalUrl = ''
    modalDescription = ''
    urlError = false
    activeSelectionRequestId = 0
    filledFromSuggestion = false
    previewingUrl = false
    lastPreviewUrl = ''
    previewFavicon = null
  }

  function deleteEntry(index: number) {
    if (editingIndex === index) {
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

  async function syncEntry(index: number) {
    syncingIndex = index
    dispatch('syncEntry', { entries: localEntries, index })
  }

  function syncAll() {
    if (syncingAll) {
      syncingAll = false
      syncingIndex = null
      dispatch('cancelSyncAll')
      return
    }
    syncingAll = true
    dispatch('syncAll', { entries: localEntries, resumeOffset })
  }

  function previewUrl() {
    const url = modalUrl.trim()
    if (!url) return
    previewingUrl = true
    lastPreviewUrl = url
    dispatch('previewLink', url)
  }

  async function copyUrl(index: number) {
    if (!(await copyText(localEntries[index].url))) return
    copiedIndex = index
    setTimeout(() => (copiedIndex = null), COPY_FEEDBACK_MS)
  }

  function openUrl(index: number) {
    dispatch('openExternal', { type: 'url', value: localEntries[index].url })
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

  function toggleExpand(index: number) {
    if (expanded.has(index)) {
      expanded.delete(index)
    } else {
      expanded.add(index)
    }
    expanded = expanded
  }

  function handleExpandKeydown(event: KeyboardEvent, index: number) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleExpand(index)
  }


</script>

<div class="link-editor editor-shell">
  <EditorHeader
    noteName={selectedNote.name}
    showFileMenu={!syncingAll}
    onRename={onRenameNote}
    onMove={onMoveNote}
    onImport={onImportNote}
    onExport={onExportNote}
    onDelete={onDeleteNote}
    on:back={() => dispatch('back')}
  >
    <div class="link-editor__header-actions">
      {#if localEntries.length > 0}
        <button
          class="icon-btn"
          on:click={syncAll}
          title={$t(syncingAll ? 'linkEditor.cancelSync' : 'linkEditor.syncAll')}
        >
          <span class={`anemona icon-refresh ${syncingAll ? 'link-editor__spin' : ''}`}></span>
        </button>
      {/if}
      {#if !syncingAll}
        <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('linkEditor.addLink')}>
          <span class="anemona icon-plus"></span>
        </button>
      {/if}
    </div>
  </EditorHeader>

  <div class="link-editor__entries entry-list" bind:this={entriesContainerElem} class:syncing-all={syncingAll}>
    {#if localEntries.length > 0}
    <SearchToolbar
      value={filterText}
      placeholder={$t('linkEditor.filterPlaceholder')}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t('linkEditor.sortAscending')}
      sortTitleDesc={$t('linkEditor.sortDescending')}
      on:input={(e) => { filterText = e.detail }}
      on:toggleSort={toggleSort}
    />
    {/if}
    {#each filteredEntries as entry, i}
      {@const realIndex = localEntries.indexOf(entry)}
      {@const isSyncing = syncingIndex === realIndex}
      <div class="link-editor__entry entry-list__item" class:syncing={realIndex === activeEntryIndex || isSyncing}>
        <div class="entry-list__row">
          <EntryTitleBar
            title={entry.title}
            menuOpen={openMenuIndex === realIndex}
            menuTitle={$t('linkEditor.entryOptions')}
            editLabel={$t('common.edit')}
            deleteLabel={$t('linkEditor.delete')}
            on:toggleMenu={() => toggleEntryMenu(realIndex)}
            on:closeMenu={closeEntryMenu}
            on:edit={() => editFromMenu(realIndex)}
            on:delete={() => deleteFromMenu(realIndex)}
          >
            <svelte:fragment slot="leading">
              <div class="link-editor__favicon-wrap">
                {#if entry.favicon}
                  <img class="link-editor__favicon" src={entry.favicon} alt="" />
                {/if}
                <span class="link-editor__status-dot" class:status-ok={entry.status === 'ok'} class:status-error={entry.status === 'error'} class:status-unknown={!entry.status || entry.status === 'unknown'}></span>
              </div>
            </svelte:fragment>
            <button
              class="icon-action"
              on:click|stopPropagation={() => copyUrl(realIndex)}
              title={$t('linkEditor.copyUrl')}
            >
              <span class={`anemona ${copiedIndex === realIndex ? 'icon-check' : 'icon-copy'}`}></span>
            </button>
            <button
              class="icon-action"
              on:click|stopPropagation={() => openUrl(realIndex)}
              title={$t('linkEditor.openUrl')}
            >
              <span class="anemona icon-external-link"></span>
            </button>
            <button
              class="icon-action"
              on:click|stopPropagation={() => syncEntry(realIndex)}
              title={$t(isSyncing ? 'linkEditor.syncing' : 'linkEditor.syncEntry')}
            >
              <span class={`anemona icon-refresh ${isSyncing ? 'link-editor__spin' : ''}`}></span>
            </button>
            {#if entry.description}
              <button
                class="icon-action"
                on:click|stopPropagation={() => toggleExpand(realIndex)}
                on:keydown={(event) => handleExpandKeydown(event, realIndex)}
                title={expanded.has(realIndex) ? $t('linkEditor.collapseDescription') : $t('linkEditor.expandDescription')}
              >
                <span class={`anemona ${expanded.has(realIndex) ? 'icon-chevron-up' : 'icon-chevron-down'}`}></span>
              </button>
            {/if}
          </EntryTitleBar>
          <div
            class="link-editor__entry-info entry-list__info"
            on:click={() => openEntry(realIndex)}
            on:keydown={(event) => handleEntryKeydown(event, realIndex)}
            role="button"
            tabindex="0"
          >
            <span class="link-editor__url entry-list__preview">{entry.url}</span>
          </div>
        </div>
        {#if entry.description && expanded.has(realIndex)}
          <div class="link-editor__description">
            <div class="link-editor__description-label">{$t('linkEditor.descriptionLabel')}</div>
            <div class="link-editor__description-text">{entry.description}</div>
          </div>
        {/if}
      </div>
    {/each}
    {#if !syncingAll}
      <button class="link-editor__add-entry add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddModal}><span class="anemona icon-plus"></span> {$t('linkEditor.addLink')}</button>
    {/if}
  </div>
</div>

{#if deletePrompt}
  <FormModal
    modalClass="delete-modal"
    title={$t('linkEditor.deleteLinkTitle')}
    on:close={cancelDeletePrompt}
  >
    <p>{$t('linkEditor.deleteLinkBody', { title: deletePrompt.title })}</p>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelDeletePrompt}>{$t('common.cancel')}</button>
      <button class="btn danger" on:click={confirmDeletePrompt}>{$t('common.delete')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

{#if modalMode}
  <FormModal
    modalClass="add-modal"
    title={modalMode === 'add' ? $t('linkEditor.addLinkTitle') : $t('linkEditor.editLinkTitle')}
    on:close={cancelModal}
  >
    <div class="link-editor__url-row">
      <div class="link-editor__url-field">
        <input class="modal-field link-editor__url-input" class:field-error={urlError} type="url" placeholder={$t('linkEditor.urlPlaceholder')} bind:this={modalUrlInput} bind:value={modalUrl} />
        {#if previewFavicon}
          <img class="link-editor__url-favicon" src={previewFavicon} alt="" />
        {/if}
      </div>
      <button class="icon-btn" on:click={previewUrl} disabled={previewingUrl || !modalUrl.trim()} title={$t('linkEditor.syncEntry')}>
        <span class={`anemona icon-refresh ${previewingUrl ? 'link-editor__spin' : ''}`}></span>
      </button>
    </div>
    <input class="modal-field" type="text" placeholder={$t('linkEditor.titlePlaceholder')} bind:value={modalTitle} />
    <textarea class="modal-field link-editor__description-field" placeholder={$t('linkEditor.descriptionPlaceholder')} bind:value={modalDescription} rows="5"></textarea>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelModal}>{$t('linkEditor.cancel')}</button>
      <button class="btn primary" on:click={saveModal}>{modalMode === 'add' ? $t('linkEditor.add') : $t('linkEditor.save')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

<style>
  .link-editor__description-field {
    resize: vertical;
  }

  .link-editor__description {
    margin: 0 var(--ui-card-pad-x) var(--ui-card-pad-y) var(--ui-card-pad-x);
    padding: 0.38rem 0.46rem;
    border-radius: var(--ui-radius-sm);
    background: var(--theme-accent-surface);
  }

  .link-editor__description-label {
    margin-bottom: 0.16rem;
    color: var(--vscode-descriptionForeground);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68em;
    line-height: 1;
  }

  .link-editor__description-text {
    color: var(--vscode-sideBarTitle-foreground);
    font-size: var(--ui-font-xs);
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .link-editor__url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .link-editor__favicon-wrap {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-right: 0.2rem;
  }

  .link-editor__favicon {
    width: 1em;
    height: 1em;
    object-fit: contain;
    flex-shrink: 0;
  }

  .link-editor__status-dot {
    display: inline-block;
    width: 0.5em;
    height: 0.5em;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .link-editor__status-dot.status-ok {
    background-color: #4caf50;
  }

  .link-editor__status-dot.status-error {
    background-color: #f44336;
  }

  .link-editor__status-dot.status-unknown {
    background-color: #9e9e9e;
  }

  .link-editor__url-row {
    display: flex;
    gap: 0.3rem;
    align-items: flex-start;
  }

  .link-editor__url-row .link-editor__url-input {
    flex: 1;
  }

  .link-editor__url-row .icon-btn {
    flex-shrink: 0;
    margin-top: 0.08rem;
  }

  .link-editor__url-field {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .link-editor__url-favicon {
    width: 1rem;
    height: 1rem;
    object-fit: contain;
    flex-shrink: 0;
  }

  .link-editor__entries.syncing-all .link-editor__entry:not(.syncing) {
    opacity: 0.5;
    pointer-events: none;
  }

  .link-editor__entry.syncing {
    background: var(--theme-accent-surface);
    border-radius: var(--ui-radius-sm);
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .link-editor__spin {
    animation: link-editor-spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes link-editor-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>