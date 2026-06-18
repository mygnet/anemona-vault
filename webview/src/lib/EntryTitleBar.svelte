<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { smartPopover } from '../utils/smartPopover'

  export let title = ''
  export let menuOpen = false
  export let menuTitle = ''
  export let editLabel = ''
  export let deleteLabel = ''

  const dispatch = createEventDispatcher<{
    toggleMenu: void
    closeMenu: void
    edit: void
    delete: void
  }>()
</script>

<div class="entry-toolbar">
  <slot name="leading" />
  <div class="entry-title-group">
    <span class="entry-title">{title}</span>
    <slot name="meta" />
  </div>
  <div class="entry-toolbar-actions">
    <slot />
    <div class="menu-wrap" class:menu-open={menuOpen}>
      <button
        class="icon-action"
        on:click|stopPropagation={() => dispatch('toggleMenu')}
        title={menuTitle}
      >
        <span class="anemona icon-dots-vertical"></span>
      </button>
      {#if menuOpen}
        <div class="menu-popover" use:smartPopover={{ open: menuOpen, onClose: () => dispatch('closeMenu') }}>
          <slot name="menu">
            <button class="menu-item" on:click|stopPropagation={() => dispatch('edit')}>
              <span class="anemona icon-edit-alt"></span>
              <span>{editLabel}</span>
            </button>
            <button class="menu-item danger" on:click|stopPropagation={() => dispatch('delete')}>
              <span class="anemona icon-trash-alt"></span>
              <span>{deleteLabel}</span>
            </button>
          </slot>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .entry-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .entry-title-group {
    display: flex;
    align-items: center;
    gap: 0.18rem;
    min-width: 0;
    flex: 1;
  }

  .entry-title-group :global(.entry-title) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.18rem;
    flex-shrink: 0;
  }

  .menu-wrap {
    position: relative;
    z-index: 0;
    flex-shrink: 0;
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
    border-radius: var(--ui-radius-md);
    box-shadow: var(--ui-shadow);
    padding: 0.14rem;
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

</style>
