<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  type Entry = { title: string; password: string; note?: string; url?: string; email?: string; username?: string; host?: string; port?: string }

  export let entries: Entry[] = []
  export let locked = false
  export let selectedNote: { name: string; filePath: string }

  const dispatch = createEventDispatcher<{
    save: { entries: Entry[]; locked: boolean }
    back: void
    unlock: string
    lock: string
  }>()

  const extraFields = [
    { key: 'url', label: 'URL' },
    { key: 'email', label: 'Email' },
    { key: 'username', label: 'User' },
    { key: 'host', label: 'Host' },
    { key: 'port', label: 'Port' },
    { key: 'note', label: 'Note' },
  ] as const

  let localEntries = entries.map((e) => ({ ...e }))
  let editingIndex: number | null = null
  let expanded: Set<number> = new Set()
  let visiblePasswords: Set<number> = new Set()
  let unlockPassword = ''
  let showAddForm = false
  let copiedKey = ''
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  let newTitle = ''
  let newPassword = ''
  let newUrl = ''
  let newEmail = ''
  let newUsername = ''
  let newHost = ''
  let newPort = ''
  let newNote = ''

  let editTitle = ''
  let editPassword = ''
  let editUrl = ''
  let editEmail = ''
  let editUsername = ''
  let editHost = ''
  let editPort = ''
  let editNote = ''

  let showLockForm = false
  let lockPassInput = ''
  let lockPassConfirm = ''
  let lockPassError = ''
  let deletePrompt: { index: number; title: string; code: string } | null = null
  let deleteCodeInput = ''

  $: if (entries !== localEntries && editingIndex === null) {
    localEntries = entries.map((e) => ({ ...e }))
  }

  function toggleExpand(index: number) {
    if (expanded.has(index)) {
      expanded.delete(index)
    } else {
      expanded.add(index)
    }
    expanded = expanded
  }

  function getField(entry: Entry, key: string): string {
    return (entry as Record<string, string | undefined>)[key] || ''
  }

  function togglePasswordVisibility(index: number, event?: Event) {
    event?.stopPropagation()
    if (visiblePasswords.has(index)) {
      visiblePasswords.delete(index)
    } else {
      visiblePasswords.add(index)
    }
    visiblePasswords = visiblePasswords
  }

  function getMaskedPassword(password: string): string {
    return '•'.repeat(Math.min(password.length, 20))
  }

  function getPropertyIcon(key: string): string {
    switch (key) {
      case 'url':
        return 'icon-globe'
      case 'email':
        return 'icon-envelope'
      case 'username':
        return 'icon-user'
      case 'host':
        return 'icon-folder'
      case 'port':
        return 'icon-terminal'
      case 'note':
        return 'icon-file-text'
      default:
        return 'icon-file-text'
    }
  }

  function resetAddForm() {
    showAddForm = false
    newTitle = ''
    newPassword = ''
    newUrl = ''
    newEmail = ''
    newUsername = ''
    newHost = ''
    newPort = ''
    newNote = ''
  }

  function resetEditForm() {
    editingIndex = null
    editTitle = ''
    editPassword = ''
    editUrl = ''
    editEmail = ''
    editUsername = ''
    editHost = ''
    editPort = ''
    editNote = ''
  }

  function collectAddEntry(): Entry {
    const e: Entry = { title: newTitle.trim(), password: newPassword.trim() }
    if (newUrl.trim()) e.url = newUrl.trim()
    if (newEmail.trim()) e.email = newEmail.trim()
    if (newUsername.trim()) e.username = newUsername.trim()
    if (newHost.trim()) e.host = newHost.trim()
    if (newPort.trim()) e.port = newPort.trim()
    if (newNote.trim()) e.note = newNote.trim()
    return e
  }

  function collectEditEntry(): Entry {
    const e: Entry = { title: editTitle.trim(), password: editPassword.trim() }
    if (editUrl.trim()) e.url = editUrl.trim()
    if (editEmail.trim()) e.email = editEmail.trim()
    if (editUsername.trim()) e.username = editUsername.trim()
    if (editHost.trim()) e.host = editHost.trim()
    if (editPort.trim()) e.port = editPort.trim()
    if (editNote.trim()) e.note = editNote.trim()
    return e
  }

  function addEntry() {
    if (!newTitle.trim() || !newPassword.trim()) return
    localEntries = [...localEntries, collectAddEntry()]
    resetAddForm()
    saveEntries()
  }

  function startEdit(index: number) {
    const e = localEntries[index]
    editingIndex = index
    editTitle = e.title
    editPassword = e.password
    editUrl = e.url || ''
    editEmail = e.email || ''
    editUsername = e.username || ''
    editHost = e.host || ''
    editPort = e.port || ''
    editNote = e.note || ''
  }

  function saveEdit() {
    if (editingIndex === null) return
    localEntries[editingIndex] = collectEditEntry()
    localEntries = localEntries
    resetEditForm()
    saveEntries()
  }

  function deleteEntry(index: number) {
    localEntries = localEntries.filter((_, i) => i !== index)
    if (editingIndex === index) resetEditForm()
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
    dispatch('save', { entries: localEntries, locked })
  }

  function doCopy(index: number, field: string, value: string) {
    navigator.clipboard.writeText(value)
    const key = `${index}:${field}`
    copiedKey = key
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copiedKey = '' }, 1200)
  }

  function handleUnlock() {
    if (unlockPassword.trim()) {
      dispatch('unlock', unlockPassword.trim())
      unlockPassword = ''
    }
  }

  function openLockForm() {
    showLockForm = true
    lockPassInput = ''
    lockPassConfirm = ''
    lockPassError = ''
  }

  function cancelLockForm() {
    showLockForm = false
    lockPassInput = ''
    lockPassConfirm = ''
    lockPassError = ''
  }

  function submitLockForm() {
    if (!lockPassInput) {
      lockPassError = 'Password is required'
      return
    }
    if (lockPassInput.length < 4) {
      lockPassError = 'Password must be at least 4 characters'
      return
    }
    if (lockPassInput !== lockPassConfirm) {
      lockPassError = 'Passwords do not match'
      return
    }
    lockPassError = ''
    showLockForm = false
    dispatch('lock', lockPassInput)
  }

  function toggleAddForm() {
    showAddForm = !showAddForm
    if (!showAddForm) resetAddForm()
  }
</script>

<div class="key-editor">
  <div class="editor-header">
    <button class="icon-btn" on:click={() => dispatch('back')} title="Back"><span class="anemona icon-arrow-back"></span></button>
    <span class="note-title">{selectedNote.name}</span>
    <div class="header-actions">
      {#if locked}
        <span class="lock-icon anemona icon-file-lock" title="Locked"></span>
      {:else}
        <button class="icon-btn lock-btn" on:click={openLockForm} title="Lock file"><span class="anemona icon-lock-alt"></span></button>
      {/if}
    </div>
  </div>

  {#if showLockForm}
    <div class="set-password-area">
      <p class="warning-text"><span class="anemona icon-slider-alt warning-icon"></span> This password locks the whole file and is never stored. If you forget it, the file <strong>cannot be recovered</strong>.</p>
      <input class="field" type="password" placeholder="File password" bind:value={lockPassInput} />
      <input class="field" type="password" placeholder="Confirm password" bind:value={lockPassConfirm} on:keydown={(e) => e.key === 'Enter' && submitLockForm()} />
      {#if lockPassError}
        <p class="field-error">{lockPassError}</p>
      {/if}
      <div class="form-actions">
        <button class="btn small primary" on:click={submitLockForm}>Lock File</button>
        <button class="btn small" on:click={cancelLockForm}>Cancel</button>
      </div>
    </div>
  {:else if locked}
    <div class="unlock-area">
      <p class="unlock-hint">This file is locked</p>
      <div class="unlock-row">
        <input
          class="unlock-input"
          type="password"
          placeholder="Enter file password"
          bind:value={unlockPassword}
          on:keydown={(e) => e.key === 'Enter' && handleUnlock()}
        />
        <button class="btn primary" on:click={handleUnlock}>Unlock</button>
      </div>
    </div>
  {:else}
    <div class="entries">
      {#each localEntries as entry, i}
        <div class="entry" class:editing={editingIndex === i}>
          {#if editingIndex === i}
            <div class="form">
              <input class="field" type="text" placeholder="Title" bind:value={editTitle} />
              <input class="field" type="text" placeholder="Password" bind:value={editPassword} />
              <input class="field" type="text" placeholder="URL (optional)" bind:value={editUrl} />
              <input class="field" type="text" placeholder="Email (optional)" bind:value={editEmail} />
              <input class="field" type="text" placeholder="User (optional)" bind:value={editUsername} />
              <input class="field" type="text" placeholder="Host (optional)" bind:value={editHost} />
              <input class="field" type="text" placeholder="Port (optional)" bind:value={editPort} />
              <input class="field" type="text" placeholder="Note (optional)" bind:value={editNote} />
              <div class="form-actions">
                <button class="btn small primary" on:click={saveEdit}>Save</button>
                <button class="btn small" on:click={resetEditForm}>Cancel</button>
                <button class="btn small danger" on:click={() => requestDeleteEntry(i)}>Delete</button>
              </div>
            </div>
          {:else}
            <div class="entry-header" on:click={() => toggleExpand(i)} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleExpand(i)}>
              <div class="entry-summary">
                <span class="entry-title">{entry.title}</span>
                <div class="entry-password-row">
                  <button class="icon-btn password-copy-btn" on:click|stopPropagation={() => doCopy(i, 'password', entry.password)} title="Copy password"><span class={`anemona ${copiedKey === `${i}:password` ? 'icon-check' : 'icon-paste'}`}></span></button>
                  <button class="icon-btn password-visibility-btn" on:click|stopPropagation={(event) => togglePasswordVisibility(i, event)} title={visiblePasswords.has(i) ? 'Hide password' : 'Show password'}><span class={`anemona ${visiblePasswords.has(i) ? 'icon-hide' : 'icon-show'}`}></span></button>
                  <span class="entry-password">{visiblePasswords.has(i) ? entry.password : getMaskedPassword(entry.password || '')}</span>
                </div>
              </div>
              <div class="entry-actions">
                <button class="icon-btn expand-btn" title={expanded.has(i) ? 'Collapse' : 'Expand'}><span class={`anemona ${expanded.has(i) ? 'icon-chevron-up' : 'icon-chevron-down'}`}></span></button>
              </div>
             </div>
             {#if expanded.has(i)}
               <div class="entry-details">
                 <div class="detail-toolbar">
                    <button class="icon-btn detail-action-btn" on:click|stopPropagation={() => startEdit(i)} title="Edit"><span class="anemona icon-edit-alt"></span></button>
                     <button class="icon-btn detail-action-btn" on:click|stopPropagation={() => requestDeleteEntry(i)} title="Delete"><span class="anemona icon-trash-alt"></span></button>
                  </div>
                  {#each extraFields as def}
                    {@const val = getField(entry, def.key)}
                    {#if val}
                     <div class="detail-row">
                        <button class="icon-btn copy-btn" on:click|stopPropagation={() => doCopy(i, def.key, val)} title="Copy {def.label}"><span class={`anemona ${copiedKey === `${i}:${def.key}` ? 'icon-check' : 'icon-paste'}`}></span></button>
                        <span class={`detail-type-icon anemona ${getPropertyIcon(def.key)}`}></span>
                        <div class="detail-copy-content">
                          <span class="detail-label">{def.label}</span>
                          <span class="detail-value">{val}</span>
                        </div>
                      </div>
                   {/if}
                 {/each}
               </div>
             {/if}
          {/if}
        </div>
      {/each}

      {#if showAddForm}
        <div class="form">
          <input class="field" type="text" placeholder="Title" bind:value={newTitle} />
          <input class="field" type="text" placeholder="Password" bind:value={newPassword} />
          <input class="field" type="text" placeholder="URL (optional)" bind:value={newUrl} />
          <input class="field" type="text" placeholder="Email (optional)" bind:value={newEmail} />
          <input class="field" type="text" placeholder="User (optional)" bind:value={newUsername} />
          <input class="field" type="text" placeholder="Host (optional)" bind:value={newHost} />
          <input class="field" type="text" placeholder="Port (optional)" bind:value={newPort} />
          <input class="field" type="text" placeholder="Note (optional)" bind:value={newNote} />
          <div class="form-actions">
            <button class="btn small primary" on:click={addEntry}>Add</button>
            <button class="btn small" on:click={resetAddForm}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="add-entry-btn" on:click={toggleAddForm}><span class="anemona icon-plus"></span> Add entry</button>
      {/if}
    </div>
  {/if}
</div>

{#if deletePrompt}
  <button class="delete-modal-backdrop" on:click={cancelDeletePrompt} aria-label="Close key delete confirmation"></button>
  <div class="delete-modal">
    <h3>Delete entry</h3>
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
      <button class="btn small" on:click={cancelDeletePrompt}>Cancel</button>
      <button class="btn small danger" on:click={confirmDeletePrompt}>Delete</button>
    </div>
  </div>
{/if}

<style>
  .key-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.18rem;
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
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  .lock-icon {
    font-size: 1.15em;
    opacity: 0.85;
  }

  .icon-btn {
    background: color-mix(in srgb, var(--vscode-sideBar-background) 95%, white 5%);
    border: 1px solid color-mix(in srgb, var(--accent-color) 10%, var(--ui-border));
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.72em;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    opacity: 0.92;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    opacity: 1;
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 16%, transparent);
  }

  .lock-btn { font-size: 1em; }

  .set-password-area {
    margin-top: 0.26rem;
    padding: 0.56rem;
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-lg);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .warning-text {
    font-size: var(--ui-font-sm);
    color: #e67e22;
    background: color-mix(in srgb, #e67e22 10%, transparent);
    padding: 0.34rem 0.44rem;
    border-radius: var(--ui-radius-sm);
    line-height: 1.4;
  }

  .warning-icon {
    margin-right: 0.25rem;
    font-size: 1.05em;
    vertical-align: middle;
  }

  .field-error {
    font-size: var(--ui-font-xs);
    color: #e74c3c;
  }

  .unlock-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    padding: 0.62rem;
    margin-top: 0.26rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-lg);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .unlock-hint {
    font-size: var(--ui-font-sm);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .unlock-row {
    display: flex;
    gap: 0.34rem;
    align-items: center;
    width: min(100%, 26rem);
  }

  .unlock-input {
    flex: 1;
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-input-background));
    color: var(--vscode-input-foreground);
    border: 1px solid color-mix(in srgb, var(--accent-color) 16%, var(--ui-border-strong));
    border-radius: var(--ui-radius-sm);
    padding: 0.34rem 0.44rem;
    font-size: var(--ui-font-sm);
    outline: none;
  }

  .unlock-input:focus { border-color: color-mix(in srgb, var(--accent-color) 38%, var(--vscode-focusBorder)); }

  .entries {
    flex: 1;
    overflow-y: auto;
    padding: 0.18rem 0 0;
  }

  .entry {
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: 6px;
    margin-bottom: 0.18rem;
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .entry:last-child { border-bottom: none; }

  .entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.28rem 0.34rem;
    cursor: pointer;
    gap: 0.26rem;
  }

  .entry-header:hover { opacity: 0.85; }

  .entry-summary {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    overflow: hidden;
    min-width: 0;
  }

  .entry-password-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }

  .password-copy-btn {
    width: 1.42rem;
    height: 1.42rem;
    font-size: 0.76em;
  }

  .password-visibility-btn {
    width: 1.42rem;
    height: 1.42rem;
    font-size: 0.76em;
  }

  .entry-title {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-password {
    font-size: var(--ui-font-xs);
    color: var(--vscode-descriptionForeground);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.14em;
  }

  .entry-actions {
    display: flex;
    gap: 0.18rem;
    flex-shrink: 0;
    align-items: center;
    padding-left: 0.2rem;
  }

  .expand-btn { font-size: 1em; }

  .entry-details {
    padding: 0 0.34rem 0.34rem 0.34rem;
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }

  .detail-toolbar {
    display: flex;
    justify-content: flex-end;
    gap: 0.2rem;
    padding: 0 0 0.15rem;
  }

  .detail-action-btn {
    width: 1.52rem;
    height: 1.52rem;
    font-size: 0.8em;
  }

  .detail-row {
    display: flex;
    align-items: flex-start;
    gap: 0.24rem;
    font-size: var(--ui-font-xs);
    background: color-mix(in srgb, var(--accent-color) 5%, var(--vscode-sideBar-background));
    border-radius: 5px;
    padding: 0.18rem 0.24rem;
  }

  .detail-type-icon {
    width: 1.42rem;
    height: 1.42rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: color-mix(in srgb, var(--accent-color) 76%, white 24%);
    font-size: 0.9em;
    flex-shrink: 0;
  }

  .detail-copy-content {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.18rem;
  }

  .detail-label {
    color: var(--vscode-descriptionForeground);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.72em;
  }

  .detail-value {
    flex: 1;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: 1em;
  }

  .copy-btn {
    font-size: 0.78em;
    width: 1.42rem;
    height: 1.42rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.34rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
  }

  .field {
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-input-background));
    color: var(--vscode-input-foreground);
    border: 1px solid color-mix(in srgb, var(--accent-color) 16%, var(--ui-border-strong));
    border-radius: var(--ui-radius-sm);
    padding: 0.3rem 0.38rem;
    font-size: var(--ui-font-sm);
    outline: none;
  }

  .field:focus {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--vscode-focusBorder));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .form-actions {
    display: flex;
    gap: 0.28rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.22rem 0.38rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-xs);
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
    padding: 0.5rem 0.58rem;
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--ui-font-md);
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

  .add-entry-btn {
    width: 100%;
    background: color-mix(in srgb, var(--accent-color) 5%, var(--vscode-editor-background));
    border: 1px dashed var(--ui-border-strong);
    border-radius: 6px;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    padding: 0.26rem;
    font-size: var(--ui-font-sm);
    font-weight: 400;
    margin-top: 0.1rem;
    opacity: 0.84;
  }

  .add-entry-btn:hover {
    opacity: 1;
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

</style>
