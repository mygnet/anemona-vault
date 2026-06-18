<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../i18n'
  import type { SortDirection } from '../lib/sortUtils'
  import EditorHeader from '../lib/EditorHeader.svelte'
  import EntryTitleBar from '../lib/EntryTitleBar.svelte'
  import SearchToolbar from '../lib/SearchToolbar.svelte'
  import DeleteConfirmModal from '../lib/DeleteConfirmModal.svelte'

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
  let titleError = false
  let codeError = false
  let modalTitleInput: HTMLInputElement
  let editingIndex: number | null = null
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
        !normalizedFilterText || [e.title, e.language, e.code].some(value => value.toLowerCase().includes(normalizedFilterText))
      )
    : localEntries.filter(e =>
        !normalizedFilterText || [e.title, e.language, e.code].some(value => value.toLowerCase().includes(normalizedFilterText))
      )

let _prevEntries = entries
$: if (entries !== localEntries && entries !== _prevEntries) {
  _prevEntries = entries
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
    if (!modalCode) modalCode = cleaned
    if (!modalTitle) modalTitle = cleaned.split('\n')[0]?.slice(0, 60) || 'Snippet'
  }
  if (modalLanguage === 'text' && selectionSuggestion.languageId) {
    modalLanguage = selectionSuggestion.languageId
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
    const titleOk = modalTitle.trim()
    const codeOk = modalCode.trim()
    titleError = !titleOk
    codeError = !codeOk
    if (!titleOk || !codeOk) return
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
    localEntries = localEntries.filter((_, i) => i !== index)
    saveEntries()
    deletePrompt = null
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

<div class="snippet-editor editor-shell">
  <EditorHeader noteName={selectedNote.name} on:back={() => dispatch('back')}>
    <div class="header-actions">
      <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('snippetEditor.addSnippet')}>
        <span class="anemona icon-plus"></span>
      </button>
    </div>
  </EditorHeader>

  <div class="entries" bind:this={entriesContainerElem}>
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
      <div class="entry">
        <div class="entry-row">
          <EntryTitleBar
            title={entry.title}
            menuOpen={openMenuIndex === i}
            menuTitle={$t('snippetEditor.entryOptions')}
            editLabel={$t('snippetEditor.rename')}
            deleteLabel={$t('snippetEditor.delete')}
            on:toggleMenu={() => toggleEntryMenu(i)}
            on:closeMenu={closeEntryMenu}
            on:edit={() => editFromMenu(realIndex)}
            on:delete={() => deleteFromMenu(realIndex)}
          >
              <span slot="meta" class="lang-badge">{entry.language}</span>
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
            class="entry-info"
            on:click={() => openEntry(realIndex)}
            on:keydown={(event) => handleEntryKeydown(event, realIndex)}
            role="button"
            tabindex="0"
          >
            <pre class="entry-preview scrollable">{entry.code}</pre>
          </div>
        </div>
      </div>
    {/each}
    <button class="add-entry-btn" on:click={openAddModal}><span class="anemona icon-plus"></span> {$t('snippetEditor.addSnippet')}</button>
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
  <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"></button>
  <div class="add-modal">
    <h3>{modalMode === 'add' ? $t('snippetEditor.addSnippetTitle') : $t('snippetEditor.editSnippetTitle')}</h3>
    <input class="modal-field" class:field-error={titleError} type="text" placeholder={$t('snippetEditor.titlePlaceholder')} bind:this={modalTitleInput} bind:value={modalTitle} />
    <select class="modal-field lang-select" bind:value={modalLanguage}>
      {#each SUPPORTED_LANGUAGES as lang}
        <option value={lang}>{lang}</option>
      {/each}
    </select>
    <textarea class="modal-field code-modal-field" class:field-error={codeError} placeholder={$t('snippetEditor.codePlaceholder')} bind:value={modalCode} rows="6"></textarea>
    <div class="modal-actions">
      <button class="btn" on:click={cancelModal}>{$t('snippetEditor.cancel')}</button>
      <button class="btn primary" on:click={saveModal}>{modalMode === 'add' ? $t('snippetEditor.add') : $t('snippetEditor.save')}</button>
    </div>
  </div>
{/if}

<style>
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

  .lang-select {
    appearance: auto;
    cursor: pointer;
  }

  .code-modal-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: vertical;
    min-height: 5rem;
  }

</style>
