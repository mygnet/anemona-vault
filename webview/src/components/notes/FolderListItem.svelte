<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import { resolveFolderAccent } from '../../utils/fileUtils'
  import MenuItem from '../ui/MenuItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

  export let folder: { name: string; path: string; color?: string; isEmpty?: boolean }
  export let menuOpen = false
  export let dragOver = false

  $: accent = resolveFolderAccent(folder.color)

  const dispatch = createEventDispatcher<{
    open: void
    toggleMenu: void
    closeMenu: void
    rename: void
    move: void
    color: void
    delete: void
    dragStart: { event: DragEvent; path: string }
    dragEnd: void
    dragOver: { event: DragEvent; path: string }
    dragEnter: { event: DragEvent; path: string }
    dragLeave: void
    drop: { event: DragEvent; path: string }
  }>()
</script>

<div
  class="notes-folder-item"
  class:notes-folder-item--drag-over={dragOver}
  draggable="true"
  role="listitem"
  on:dragstart={(event) => dispatch('dragStart', { event, path: folder.path })}
  on:dragend={() => dispatch('dragEnd')}
  on:dragover={(event) => dispatch('dragOver', { event, path: folder.path })}
  on:dragenter={(event) => dispatch('dragEnter', { event, path: folder.path })}
  on:dragleave={() => dispatch('dragLeave')}
  on:drop={(event) => dispatch('drop', { event, path: folder.path })}
  style={accent ? `--folder-accent: ${accent}; --folder-accent-text: color-mix(in srgb, ${accent} 82%, white 18%); --folder-accent-bg: color-mix(in srgb, ${accent} 10%, var(--vscode-editor-background)); --folder-accent-hover: color-mix(in srgb, ${accent} 14%, transparent); --folder-accent-active: color-mix(in srgb, ${accent} 22%, transparent); --folder-accent-border: color-mix(in srgb, ${accent} 24%, transparent); --folder-accent-border-strong: color-mix(in srgb, ${accent} 42%, transparent);` : ''}
>
  <button class="notes-folder-item__button" on:click={() => dispatch('open')}>
    <span class="notes-folder-item__icon anemona icon-folder"></span>
    <span class="notes-folder-item__name">{folder.name}</span>
  </button>
  <div class="notes-folder-item__actions">
    <PopoverMenu
      open={menuOpen}
      triggerClass="icon-btn notes-folder-item__action-trigger"
      title={$t('notesList.folderOptions')}
      on:toggle={() => dispatch('toggleMenu')}
      on:close={() => dispatch('closeMenu')}
    >
      <MenuItem icon="icon-edit-alt" label={$t('notesList.rename')} on:select={() => dispatch('rename')} />
      <MenuItem icon="icon-move" label={$t('notesList.moveTo')} on:select={() => dispatch('move')} />
      <MenuItem icon="icon-color-fill" label={$t('notesList.color')} on:select={() => dispatch('color')} />
      {#if folder.isEmpty !== false}
        <MenuItem icon="icon-trash-alt" label={$t('notesList.delete')} danger on:select={() => dispatch('delete')} />
      {/if}
    </PopoverMenu>
  </div>
</div>

<style>
  .notes-folder-item {
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
    background: var(--folder-accent-bg, transparent);
  }

  .notes-folder-item:hover {
    background: var(--folder-accent-hover, var(--theme-notes-row-hover-bg));
    border-color: var(--folder-accent-border, var(--theme-notes-row-border));
  }

  .notes-folder-item[draggable='true'] {
    cursor: grab;
  }

  .notes-folder-item[draggable='true']:active {
    cursor: grabbing;
  }

  .notes-folder-item.notes-folder-item--drag-over {
    background: var(--folder-accent-active, var(--theme-notes-row-active-bg)) !important;
    border-color: var(--folder-accent-border-strong, var(--theme-notes-row-border-strong)) !important;
    box-shadow: inset 0 0 0 1px var(--folder-accent-border-strong, var(--theme-notes-row-border-strong));
  }

  .notes-folder-item__button {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.16rem;
    background: none;
    border: none;
    color: var(--folder-accent-text, var(--theme-notes-folder-text));
    cursor: pointer;
    font-size: var(--ui-font-entry);
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.92;
  }

  .notes-folder-item__button:hover {
    opacity: 1;
  }

  .notes-folder-item__icon {
    font-size: 0.9em;
    flex-shrink: 0;
    opacity: 0.92;
    color: var(--folder-accent, currentColor);
  }

  .notes-folder-item__name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    letter-spacing: 0;
  }

  .notes-folder-item__actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    margin-right: 0.12rem;
  }

  :global(.notes-folder-item__action-trigger) {
    opacity: 0.55;
    font-size: 1em;
  }
</style>
