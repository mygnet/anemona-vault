<script lang="ts">
  import { t } from '../../i18n'
  import EditorHeader from '../layout/EditorHeader.svelte'
  import { renderMarkdown } from '../../utils/markdown'
  export let noteContent = "";
  export let selectedNote: { name: string; filePath: string };
  export let onSave: (content: string) => void;
  export let onBack: () => void;
  export let onRenameNote: (() => void) | null = null;
  export let onMoveNote: (() => void) | null = null;
  export let onImportNote: (() => void) | null = null;
  export let onExportNote: (() => void) | null = null;
  export let onDeleteNote: (() => void) | null = null;

  let editing = false;
  let editContent = "";

  function startEdit() {
    editContent = noteContent;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  function toggleEditing() {
    if (editing) {
      save();
    } else {
      startEdit();
    }
  }

  function save() {
    onSave(editContent);
    editing = false;
  }

  $: renderedContent = renderMarkdown(noteContent, `<p class="note-editor__empty-render">${$t('noteEditor.selectNote')}</p>`);
</script>

<div class="note-editor">
  <EditorHeader
    noteName={selectedNote.name}
    showFileMenu={true}
    onRename={onRenameNote}
    onMove={onMoveNote}
    onImport={onImportNote}
    onExport={onExportNote}
    onDelete={onDeleteNote}
    on:back={onBack}
  >
    <div class="note-editor__header-actions">
      <button class="icon-btn primary-btn" on:click={toggleEditing} title={editing ? $t('noteEditor.save') : $t('noteEditor.edit')}><span class="anemona {editing ? 'icon-check' : 'icon-edit-alt'}"></span></button>
    </div>
  </EditorHeader>

  <div class="note-editor__body">
    {#if editing}
      <textarea
        class="note-editor__textarea"
        bind:value={editContent}
        spellcheck="false"
      ></textarea>
    {:else}
      <div class="note-editor__preview">
        {@html renderedContent}
      </div>
    {/if}
  </div>
</div>

<style>
  .note-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.18rem;
    box-sizing: border-box;
  }

  .note-editor__body {
    flex: 1;
    overflow: hidden;
    margin-top: 0.16rem;
    border: 1px solid var(--theme-accent-border);
    border-radius: var(--ui-radius-lg);
    background: var(--theme-accent-surface);
  }

  .note-editor__textarea {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    background: transparent;
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    padding: 0.44rem;
    outline: none;
    box-sizing: border-box;
    line-height: 1.6;
  }

  .note-editor__preview {
    height: 100%;
    overflow-y: auto;
    padding: 0.5rem;
    color: var(--vscode-editor-foreground);
    font-size: var(--ui-font-sm);
    line-height: 1.45;
    box-sizing: border-box;
  }

  .note-editor__preview :global(h1),
  .note-editor__preview :global(h2),
  .note-editor__preview :global(h3),
  .note-editor__preview :global(h4),
  .note-editor__preview :global(h5),
  .note-editor__preview :global(h6) {
    margin: 0 0 0.55rem;
    line-height: 1.25;
    color: var(--theme-accent-text);
  }

  .note-editor__preview :global(h1) {
    font-size: 1.5rem;
    border-bottom: 1px solid var(--theme-accent-border-hover);
    padding-bottom: 0.3rem;
  }

  .note-editor__preview :global(h2) { font-size: 1.22rem; }
  .note-editor__preview :global(h3) { font-size: 1.06rem; }

  .note-editor__preview :global(p),
  .note-editor__preview :global(ul),
  .note-editor__preview :global(ol),
  .note-editor__preview :global(blockquote),
  .note-editor__preview :global(pre) {
    margin: 0 0 0.62rem;
  }

  .note-editor__preview :global(ul),
  .note-editor__preview :global(ol) {
    padding-left: 1.15rem;
  }

  .note-editor__preview :global(li + li) {
    margin-top: 0.2rem;
  }

  .note-editor__preview :global(blockquote) {
    border-left: 3px solid var(--theme-accent-border-strong);
    padding: 0.1rem 0 0.1rem 0.62rem;
    color: var(--ui-muted);
  }

  .note-editor__preview :global(code) {
    font-family: var(--vscode-editor-font-family, monospace);
    background: color-mix(in srgb, var(--vscode-sideBar-background) 68%, transparent);
    border-radius: 0.35rem;
    padding: 0.12rem 0.32rem;
    font-size: 0.92em;
  }

  .note-editor__preview :global(pre) {
    background: var(--theme-accent-surface-hover);
    border: 1px solid var(--theme-accent-border);
    border-radius: var(--ui-radius-md);
    padding: 0.62rem 0.72rem;
    overflow-x: auto;
  }

  .note-editor__preview :global(pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
  }

  .note-editor__preview :global(a) {
    color: var(--theme-accent-text);
    text-decoration: none;
  }

  .note-editor__preview :global(a:hover) {
    text-decoration: underline;
  }

  .note-editor__preview :global(.note-editor__empty-render) {
    color: var(--ui-muted);
  }
</style>
