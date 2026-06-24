<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import { getFileTypeIconClass } from '../../utils/fileUtils'
  import MenuItem from '../ui/MenuItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

  export let note: {
    name: string
    filePath: string
    fileType?: string
    displayName?: string
    progress?: number
  }
  export let menuOpen = false

  const dispatch = createEventDispatcher<{
    select: void
    toggleMenu: void
    closeMenu: void
    rename: void
    move: void
    import: void
    export: void
    delete: void
    dragStart: { event: DragEvent; path: string }
    dragEnd: void
  }>()
</script>

<div
  class="notes-list-item"
  draggable="true"
  role="listitem"
  on:dragstart={(event) => dispatch('dragStart', { event, path: note.filePath })}
  on:dragend={() => dispatch('dragEnd')}
>
  <button class="notes-list-item__button" on:click={() => dispatch('select')}>
    <span class={`notes-list-item__icon anemona ${getFileTypeIconClass(note.fileType, note.name)}`}></span>
    <span class="notes-list-item__name">{note.displayName || note.name}</span>
  </button>
  <div class="notes-list-item__actions">
    <PopoverMenu
      open={menuOpen}
      triggerClass="icon-btn notes-list-item__action-trigger"
      title={$t('notesList.fileOptions')}
      on:toggle={() => dispatch('toggleMenu')}
      on:close={() => dispatch('closeMenu')}
    >
      <MenuItem icon="icon-edit-alt" label={$t('notesList.rename')} on:select={() => dispatch('rename')} />
      <MenuItem icon="icon-move" label={$t('notesList.moveTo')} on:select={() => dispatch('move')} />
      <MenuItem icon="icon-import" label={$t('notesList.import')} on:select={() => dispatch('import')} />
      <MenuItem icon="icon-export" label={$t('notesList.export')} on:select={() => dispatch('export')} />
      <MenuItem icon="icon-trash-alt" label={$t('notesList.delete')} danger on:select={() => dispatch('delete')} />
    </PopoverMenu>
  </div>
  {#if note.fileType === 'todo' && note.progress}
    <div class="notes-list-item__progress">
      <span class="notes-list-item__progress-fill" style="width:{note.progress}%"></span>
    </div>
  {/if}
</div>

<style>
  .notes-list-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    transition:
      background 0.14s,
      border-color 0.14s;
    min-height: calc(var(--ui-control-height) + 0.04rem);
  }

  .notes-list-item:hover {
    background: var(--theme-notes-row-hover-bg);
    border-color: var(--theme-notes-row-border);
  }

  .notes-list-item[draggable='true'] {
    cursor: grab;
  }

  .notes-list-item[draggable='true']:active {
    cursor: grabbing;
  }

  .notes-list-item__button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.16rem;
    background: none;
    border: none;
    color: var(--theme-notes-file-text);
    cursor: pointer;
    font-size: var(--ui-font-entry);
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.78;
  }

  .notes-list-item__button:hover {
    opacity: 1;
  }

  .notes-list-item__icon {
    font-size: 0.9em;
    flex-shrink: 0;
    opacity: 0.92;
  }

  .notes-list-item__name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    letter-spacing: 0;
  }

  .notes-list-item__actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    margin-right: 0.12rem;
  }

  :global(.notes-list-item__action-trigger) {
    opacity: 0.55;
    font-size: 1em;
  }

  .notes-list-item__progress {
    width: 100%;
    height: 2px;
    background: var(--theme-editor-soft-bg);
    border-radius: 1px;
    margin: 0 0.34rem 0.1rem;
    overflow: hidden;
    flex: 0 0 100%;
  }

  .notes-list-item__progress-fill {
    display: block;
    height: 100%;
    background: var(--theme-accent-readable);
    border-radius: 1px;
    transition: width 0.3s ease;
  }
</style>
