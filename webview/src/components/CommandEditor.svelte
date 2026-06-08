<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { smartPopover } from '../utils/smartPopover'

  export let entries: { title: string; command: string }[] = []
  export let selectedNote: { name: string; filePath: string }

  const dispatch = createEventDispatcher<{
    save: typeof entries
    back: void
  }>()

  let localEntries = entries.map((e) => ({ ...e }))
  let copiedIndex: number | null = null
  let editingIndex: number | null = null
  let openMenuIndex: number | null = null
  let editTitle = ''
  let editCommand = ''
  let showAddForm = false
  let newTitle = ''
  let newCommand = ''
  let deletePrompt: { index: number; title: string; code: string } | null = null
  let deleteCodeInput = ''

  $: if (entries !== localEntries && editingIndex === null) {
    localEntries = entries.map((e) => ({ ...e }))
  }

  function toggleAddForm() {
    showAddForm = !showAddForm
    newTitle = ''
    newCommand = ''
  }

  function addEntry() {
    if (!newTitle.trim() || !newCommand.trim()) return
    localEntries = [...localEntries, { title: newTitle.trim(), command: newCommand.trim() }]
    showAddForm = false
    newTitle = ''
    newCommand = ''
    saveEntries()
  }

  function startEdit(index: number) {
    editingIndex = index
    editTitle = localEntries[index].title
    editCommand = localEntries[index].command
  }

  function cancelEdit() {
    editingIndex = null
  }

  function saveEdit() {
    if (editingIndex === null) return
    localEntries[editingIndex] = { title: editTitle.trim(), command: editCommand.trim() }
    localEntries = localEntries
    editingIndex = null
    saveEntries()
  }

  function deleteEntry(index: number) {
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
    if (editingIndex === index) {
      cancelEdit()
    }
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

  function openEntry(index: number) {
    startEdit(index)
  }

  function toggleEntryMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index
  }

  function editFromMenu(index: number) {
    openMenuIndex = null
    startEdit(index)
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
  </div>

  <div class="entries">
    {#each localEntries as entry, i}
      <div class="entry" class:editing={editingIndex === i}>
        {#if editingIndex === i}
          <div class="edit-form">
            <input class="field" type="text" placeholder="Title" bind:value={editTitle} />
            <textarea class="field cmd-field" placeholder="Command" bind:value={editCommand} rows="2"></textarea>
            <div class="edit-actions">
              <button class="btn small primary" on:click={saveEdit}>Save</button>
              <button class="btn small" on:click={cancelEdit}>Cancel</button>
              <button class="btn small danger" on:click={() => requestDeleteEntry(i)}>Delete</button>
            </div>
          </div>
        {:else}
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
                  <span class={`anemona ${copiedIndex === i ? 'icon-check' : 'icon-paste'}`}></span>
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
        {/if}
      </div>
    {/each}

    {#if showAddForm}
      <div class="add-form">
        <input class="field" type="text" placeholder="Title" bind:value={newTitle} />
        <textarea class="field cmd-field" placeholder="Command" bind:value={newCommand} rows="2"></textarea>
        <div class="add-actions">
          <button class="btn small primary" on:click={addEntry}>Add</button>
          <button class="btn small" on:click={toggleAddForm}>Cancel</button>
        </div>
      </div>
    {:else}
      <button class="add-entry-btn" on:click={toggleAddForm}><span class="anemona icon-plus"></span> Add command</button>
    {/if}
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
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  }

  .icon-btn:hover {
    opacity: 1;
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 16%, transparent);
  }

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

  .entry-row {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.16rem;
    padding: 0.28rem 0.34rem;
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
    font-size: 0.68rem;
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

  .copy-btn { font-size: 1em; flex-shrink: 0; }

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
    border-radius: 6px;
    box-shadow: var(--ui-shadow);
    padding: 0.18rem;
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
    border-radius: 6px;
    padding: 0.28rem 0.36rem;
    cursor: pointer;
    font-size: 0.67rem;
    text-align: left;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  }

  .menu-item.danger {
    color: #e87070;
  }

  .edit-form, .add-form {
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
    font-family: inherit;
  }

  .field:focus {
    border-color: color-mix(in srgb, var(--accent-color) 38%, var(--vscode-focusBorder));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .cmd-field {
    font-family: var(--vscode-editor-font-family, monospace);
    resize: none;
  }

  .edit-actions, .add-actions {
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
    padding: 0.34rem;
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
