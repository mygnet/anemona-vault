<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../i18n'
  import EditorHeader from '../lib/EditorHeader.svelte'
  import EntryTitleBar from '../lib/EntryTitleBar.svelte'
  import SearchToolbar from '../lib/SearchToolbar.svelte'
  import DeleteConfirmModal from '../lib/DeleteConfirmModal.svelte'
  import { formatDate, floorToMinute } from '../lib/utils'

  type ReminderAction = {
    type: 'none' | 'file' | 'url' | 'command' | 'task'
    target: string
  }

  type ReminderEntry = {
    id: string
    title?: string
    text: string
    dueAt: string
    status: 'pending' | 'completed'
    action: ReminderAction
    createdAt: string
    updatedAt: string
  }

  export let entries: ReminderEntry[] = []
  export let selectedNote: { name: string; filePath: string }
  export let initialFilterText = ''

  const dispatch = createEventDispatcher<{
    save: ReminderEntry[]
    back: void
    openUrl: string
  }>()

  let localEntries = entries.map((e) => ({ ...e, action: { ...e.action } }))
  let filterStatus: 'all' | 'pending' | 'completed' = 'all'
  let filterText = ''
  let activeMenuIndex: number | null = null
  let modalMode: 'add' | 'edit' | null = null
  let editingIndex: number | null = null
  let editingTitle = ''
  let editingText = ''
  let editingDueMode: 'none' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'specific' = 'none'
  let editingDueValue = 1
  let editingDueDate = ''
  let editingActionTarget = ''
  let titleError = false
  let titleInput: HTMLInputElement
  let textInput: HTMLTextAreaElement
  let deletePrompt: { index: number; title: string } | null = null
  let lastAppliedInitialFilter = ''

  let _prevEntries = entries
  $: if (entries !== localEntries && entries !== _prevEntries) {
    _prevEntries = entries
    localEntries = entries.map((e) => ({ ...e, action: { ...e.action } }))
  }

  $: pendingEntries = localEntries.filter((e) => e.status === 'pending')
  $: completedEntries = localEntries.filter((e) => e.status === 'completed')

  $: normalizedFilterText = filterText.trim().toLowerCase()

  $: visibleEntries = localEntries
    .filter((entry) => {
      if (filterStatus !== 'all' && entry.status !== filterStatus) return false
      if (normalizedFilterText && ![getReminderTitle(entry), entry.text].join(' ').toLowerCase().includes(normalizedFilterText)) return false
      return true
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      if (a.dueAt && b.dueAt) return b.dueAt.localeCompare(a.dueAt)
      if (a.dueAt) return -1
      if (b.dueAt) return 1
      return 0
    })

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText
    lastAppliedInitialFilter = initialFilterText
  }

  function deriveTitle(text: string): string {
    return text.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ') || 'Untitled'
  }

  function getReminderTitle(entry: ReminderEntry): string {
    return entry.title?.trim() || deriveTitle(entry.text)
  }

  function computeDueIso(): string {
    const now = floorToMinute(new Date())
    switch (editingDueMode) {
      case 'none':
        return ''
      case 'minutes':
        return new Date(now.getTime() + editingDueValue * 60 * 1000).toISOString()
      case 'hours':
        return new Date(now.getTime() + editingDueValue * 60 * 60 * 1000).toISOString()
      case 'days':
        return new Date(now.getTime() + editingDueValue * 24 * 60 * 60 * 1000).toISOString()
      case 'weeks':
        return new Date(now.getTime() + editingDueValue * 7 * 24 * 60 * 60 * 1000).toISOString()
      case 'months':
        return new Date(now.getFullYear(), now.getMonth() + editingDueValue, now.getDate()).toISOString()
      case 'specific':
        return editingDueDate ? floorToMinute(new Date(editingDueDate)).toISOString() : ''
      default:
        return ''
    }
  }

  function getRelativeDueLabel(dueAt: string): string {
    if (!dueAt) return ''
    const dueTime = new Date(dueAt).getTime()
    if (Number.isNaN(dueTime)) return ''
    const diff = dueTime - Date.now()
    const overdue = diff < 0
    const absMin = Math.max(1, Math.round(Math.abs(diff) / 60000))
    const units = [
      { label: 'month', minutes: 60 * 24 * 30 },
      { label: 'week', minutes: 60 * 24 * 7 },
      { label: 'day', minutes: 60 * 24 },
      { label: 'hour', minutes: 60 },
      { label: 'minute', minutes: 1 },
    ]
    const unit = units.find((u) => absMin >= u.minutes) || units[units.length - 1]
    const value = Math.max(1, Math.round(absMin / unit.minutes))
    const suffix = value === 1 ? unit.label : `${unit.label}s`
    return overdue ? $t('reminderEditor.overdue', { value, unit: suffix }) : $t('reminderEditor.dueIn', { value, unit: suffix })
  }

  function getDueTone(dueAt: string): 'late' | 'soon' | 'future' {
    if (!dueAt) return 'future'
    const diff = new Date(dueAt).getTime() - Date.now()
    if (Number.isNaN(diff)) return 'future'
    if (diff < 0) return 'late'
    if (diff <= 1000 * 60 * 60 * 24 * 3) return 'soon'
    return 'future'
  }

  function generateId(): string {
    const hex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      '4' + hex.slice(13, 16),
      '8' + hex.slice(17, 20),
      hex.slice(20, 32),
    ].join('-')
  }

  function emitSave() {
    dispatch('save', localEntries.map((e) => ({
      ...e,
      title: (e.title || getReminderTitle(e)).trim(),
      text: e.text.trim(),
      dueAt: e.dueAt,
      status: e.status,
      action: { ...e.action },
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })).filter((e) => e.title))
  }

  async function openAddModal() {
    modalMode = 'add'
    editingIndex = null
    editingTitle = ''
    editingText = ''
    editingDueMode = 'none'
    editingDueValue = 1
    editingDueDate = ''
    editingActionTarget = ''
    titleError = false
    await tick()
    titleInput?.focus()
  }

  function openEditModal(index: number) {
    activeMenuIndex = null
    const entry = localEntries[index]
    modalMode = 'edit'
    editingIndex = index
    editingTitle = getReminderTitle(entry)
    editingText = entry.text
    editingDueDate = entry.dueAt ? new Date(entry.dueAt).toISOString().slice(0, 16) : ''
    editingDueMode = entry.dueAt ? 'specific' : 'none'
    editingDueValue = 1
    editingActionTarget = entry.action?.target || ''
    titleError = false
  }

  function cancelModal() {
    modalMode = null
    editingIndex = null
    editingTitle = ''
    editingText = ''
    editingDueMode = 'none'
    editingDueValue = 1
    editingDueDate = ''
    editingActionTarget = ''
    titleError = false
  }

  function saveModal() {
    const title = editingTitle.trim()
    const text = editingText.trim()
    titleError = !title
    if (!title) {
      return
    }
    titleError = false

    const now = new Date().toISOString()
    const dueAt = computeDueIso()
    const urlTarget = editingActionTarget.trim()
    const action: ReminderAction = {
      type: urlTarget ? 'url' : 'none',
      target: urlTarget,
    }

    if (modalMode === 'add') {
      localEntries = [...localEntries, {
        id: generateId(),
        title,
        text,
        dueAt,
        status: 'pending',
        action,
        createdAt: now,
        updatedAt: now,
      }]
      tick().then(() => {
        const el = document.querySelector('.reminder-list')
        if (el) el.scrollTop = el.scrollHeight
      })
    } else if (editingIndex !== null) {
      localEntries[editingIndex] = {
        ...localEntries[editingIndex],
        title,
        text,
        dueAt,
        action,
        updatedAt: now,
      }
      localEntries = localEntries
    }

    cancelModal()
    emitSave()
  }

  function toggleComplete(index: number) {
    const current = localEntries[index]
    const status = current.status === 'completed' ? 'pending' : 'completed'
    localEntries[index] = { ...current, status, updatedAt: new Date().toISOString() }
    localEntries = localEntries
    emitSave()
  }

  function removeEntry(index: number) {
    localEntries = localEntries.filter((_, i) => i !== index)
    emitSave()
  }

  function requestDeleteEntry(index: number) {
    activeMenuIndex = null
    deletePrompt = { index, title: getReminderTitle(localEntries[index]) }
  }

  function toggleEntryMenu(index: number) {
    activeMenuIndex = activeMenuIndex === index ? null : index
  }

  function closeEntryMenu() {
    activeMenuIndex = null
  }

  function cancelDeletePrompt() {
    deletePrompt = null
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return
    localEntries = localEntries.filter((_, i) => i !== deletePrompt.index)
    deletePrompt = null
    emitSave()
  }

  function getActionLabel(action: ReminderAction): string {
    if (action.type === 'none') return ''
    if (action.type === 'file') return `📄 ${action.target}`
    if (action.type === 'url') return `🔗 ${action.target}`
    if (action.type === 'command') return `⚡ ${action.target}`
    if (action.type === 'task') return `📋 ${action.target}`
    return ''
  }
</script>

<div class="reminder-editor editor-shell">
  <EditorHeader noteName={selectedNote.name} on:back={() => dispatch('back')}>
    <div class="header-actions">
      <button class="icon-btn primary-btn" on:click={openAddModal} title={$t('reminderEditor.addReminder')}><span class="anemona icon-plus"></span></button>
    </div>
  </EditorHeader>

  <SearchToolbar
    value={filterText}
    placeholder={$t('reminderEditor.searchPlaceholder')}
    showSort={false}
    on:input={(e) => { filterText = e.detail }}
  />

  <div class="filter-row">
    <button class="filter-chip" class:active={filterStatus === 'all'} on:click={() => (filterStatus = 'all')}>
      {$t('reminderEditor.allCount', { count: localEntries.length })}
    </button>
    <button class="filter-chip" class:active={filterStatus === 'pending'} on:click={() => (filterStatus = 'pending')}>
      {$t('reminderEditor.pendingCount', { count: pendingEntries.length })}
    </button>
    <button class="filter-chip" class:active={filterStatus === 'completed'} on:click={() => (filterStatus = 'completed')}>
      {$t('reminderEditor.completedCount', { count: completedEntries.length })}
    </button>
  </div>

  <div class="reminder-list">
      {#if visibleEntries.length === 0}
        {#if localEntries.length > 0}
          <div class="empty-state">{$t('reminderEditor.emptyFilters')}</div>
        {/if}
      {:else}
      {#each visibleEntries as item, idx}
        {@const entry = item}
        {@const realIndex = localEntries.indexOf(entry)}
        <div
          class="reminder-card"
          class:completed={entry.status === 'completed'}
          style={entry.status === 'pending' && entry.dueAt ? `--due-tone: ${getDueTone(entry.dueAt)};` : ''}
        >
          <div class="reminder-copy">
            <EntryTitleBar
              title={getReminderTitle(entry)}
              menuOpen={activeMenuIndex === realIndex}
              menuTitle={$t('reminderEditor.entryOptions')}
              editLabel={$t('common.edit')}
              deleteLabel={$t('reminderEditor.delete')}
              on:toggleMenu={() => toggleEntryMenu(realIndex)}
              on:closeMenu={closeEntryMenu}
              on:edit={() => openEditModal(realIndex)}
              on:delete={() => requestDeleteEntry(realIndex)}
            >
              <button
                slot="leading"
                class="check-toggle"
                on:click={() => toggleComplete(realIndex)}
                title={entry.status === 'completed' ? $t('reminderEditor.markPending') : $t('reminderEditor.markCompleted')}
              >
                <span class={`anemona ${entry.status === 'completed' ? 'icon-checked' : 'icon-checkbox'}`}></span>
              </button>
            </EntryTitleBar>
            <div class="item-body">
              {#if entry.text}
                <div class="item-text">{entry.text}</div>
              {/if}
              <div class="reminder-meta">
                {#if entry.dueAt}
                  <span class={`due-label ${getDueTone(entry.dueAt)}`}>
                    {getRelativeDueLabel(entry.dueAt)} — {formatDate(entry.dueAt)}
                  </span>
                {:else}
                  <span class="due-label none">{$t('reminderEditor.noDueDate')}</span>
                {/if}
                <span class="status-badge" class:completed={entry.status === 'completed'}>
                  {entry.status}
                </span>
                {#if entry.action.type === 'url'}
                  <button
                    class="action-link"
                    on:click|stopPropagation={() => dispatch('openUrl', entry.action.target)}
                    title={entry.action.target}
                  >
                    <span class="anemona icon-globe"></span>
                  </button>
                {:else if entry.action.type !== 'none'}
                  <span class="action-label">{getActionLabel(entry.action)}</span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
      {/if}
    <button class="add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddModal}>
      <span class="anemona icon-plus"></span> {$t('reminderEditor.addReminder')}
    </button>
  </div>

  {#if modalMode}
    <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"></button>
    <div class="form-modal">
      <h3>{modalMode === 'add' ? $t('reminderEditor.addReminderTitle') : $t('reminderEditor.editReminderTitle')}</h3>

      <label class="field-label" for="reminder-title-input">{$t('common.title')}</label>
      <input
        id="reminder-title-input"
        class="form-input"
        class:field-error={titleError}
        type="text"
        bind:this={titleInput}
        bind:value={editingTitle}
        placeholder={$t('common.title')}
      />

      <label class="field-label" for="reminder-text-input">{$t('reminderEditor.textLabel')}</label>
      <textarea
        id="reminder-text-input"
        class="form-input form-textarea"
        bind:this={textInput}
        bind:value={editingText}
        rows="3"
        placeholder={$t('reminderEditor.textPlaceholder')}
      ></textarea>

      <div role="group" aria-label="Due date">
        <div class="due-options">
          <button class="due-option" class:active={editingDueMode === 'none'} on:click={() => (editingDueMode = 'none')}>
            {$t('reminderEditor.noDate')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'minutes'} on:click={() => (editingDueMode = 'minutes')}>
            {$t('reminderEditor.inMinutes')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'hours'} on:click={() => (editingDueMode = 'hours')}>
            {$t('reminderEditor.inHours')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'days'} on:click={() => (editingDueMode = 'days')}>
            {$t('reminderEditor.inDays')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'weeks'} on:click={() => (editingDueMode = 'weeks')}>
            {$t('reminderEditor.inWeeks')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'months'} on:click={() => (editingDueMode = 'months')}>
            {$t('reminderEditor.inMonths')}
          </button>
          <button class="due-option" class:active={editingDueMode === 'specific'} on:click={() => (editingDueMode = 'specific')}>
            {$t('reminderEditor.specificDate')}
          </button>
        </div>

        {#if editingDueMode !== 'none' && editingDueMode !== 'specific'}
        <div class="due-value-row">
          <input
            class="form-input due-value"
            type="number"
            min="1"
            bind:value={editingDueValue}
          />
          <span class="due-unit-label">
            {$t('reminderEditor.' + editingDueMode)}
          </span>
        </div>
      {/if}

      {#if editingDueMode === 'specific'}
        <input
          class="form-input"
          type="datetime-local"
          bind:value={editingDueDate}
        />
      {/if}
      </div>

      <label class="field-label" for="reminder-url-input">{$t('reminderEditor.urlLabel')}</label>
      <input
        id="reminder-url-input"
        class="form-input"
        type="url"
        bind:value={editingActionTarget}
        placeholder={$t('reminderEditor.urlPlaceholder')}
      />

      <div class="form-actions">
        <button class="btn" on:click={cancelModal}>{$t('reminderEditor.cancel')}</button>
        <button class="btn primary" on:click={saveModal}>
          {modalMode === 'add' ? $t('reminderEditor.add') : $t('reminderEditor.save')}
        </button>
      </div>
    </div>
  {/if}

  <DeleteConfirmModal
    show={deletePrompt !== null}
    title={$t('reminderEditor.deleteReminderTitle')}
    itemName={deletePrompt ? deletePrompt.title : ''}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />
</div>

<style>
  .reminder-list {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.24rem;
  }

  .empty-state {
    padding: 0.72rem 0.58rem;
    border: 1px dashed color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    color: var(--ui-muted);
    text-align: center;
    font-size: var(--ui-font-sm);
    background: color-mix(in srgb, var(--accent-color) 4%, transparent);
  }

  .reminder-card {
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    margin-bottom: 0.18rem;
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    border: 1px solid color-mix(in srgb, var(--accent-color) 9%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .reminder-card.completed {
    opacity: 0.7;
  }

  :global(.reminder-card.completed .entry-title) {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .reminder-card.completed .item-text {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .reminder-copy {
    min-width: 0;
  }



  :global(.reminder-card .entry-title) {
    width: 100%;
    color: var(--vscode-sideBarTitle-foreground);
    font-size: 0.62rem;
    font-weight: 400;
    line-height: 1.18;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }



  .reminder-meta {
    display: flex;
    align-items: center;
    gap: 0.14rem;
    flex-wrap: wrap;
    font-size: 0.52rem;
    line-height: 1.1;
  }

  .due-label {
    font-size: 0.52rem;
    letter-spacing: 0.01em;
    color: var(--ui-muted);
  }

  .due-label.late {
    color: #ffb0b3;
  }

  .due-label.soon {
    color: #ffd792;
  }

  .due-label.none {
    color: var(--ui-muted);
  }

  .status-badge {
    font-size: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    padding: 0.02rem 0.16rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent-color) 16%, transparent);
    background: color-mix(in srgb, var(--accent-color) 6%, transparent);
    color: color-mix(in srgb, var(--accent-color) 64%, var(--vscode-sideBarTitle-foreground));
  }

  .status-badge.completed {
    color: #68c3a0;
    border-color: color-mix(in srgb, #68c3a0 26%, transparent);
    background: color-mix(in srgb, #68c3a0 10%, transparent);
  }

  .action-label {
    font-size: 0.5rem;
    color: var(--vscode-textLink-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 8rem;
  }

  .action-link {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    border: none;
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0.06rem 0.2rem;
    border-radius: var(--ui-radius-sm);
    line-height: 1;
  }

  .action-link:hover {
    background: color-mix(in srgb, var(--accent-color) 16%, transparent);
    color: var(--vscode-textLink-activeForeground);
  }

  .due-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-top: 0.2rem;
  }

  .due-option {
    padding: 0.16rem 0.3rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--vscode-foreground);
    font-size: var(--ui-font-xs);
    cursor: pointer;
  }

  .due-option.active {
    border-color: color-mix(in srgb, var(--accent-color) 26%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .due-value-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }

  .due-value {
    width: 5rem;
  }

  .due-unit-label {
    font-size: var(--ui-font-sm);
    color: var(--ui-muted);
  }

  .code-input {
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin-bottom: 0.8rem;
  }

  .modal-error {
    margin: 0.55rem 0 0;
    font-size: var(--ui-font-xs);
    color: #ff8d8d;
  }

</style>
