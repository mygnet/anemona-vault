<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import MenuItem from '../ui/MenuItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

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

<div class="entry-title-bar">
  <slot name="leading" />
  <div class="entry-title-bar__title-group">
    <span class="entry-title">{title}</span>
    <slot name="meta" />
  </div>
  <div class="entry-title-bar__actions">
    <slot />
    <PopoverMenu
      open={menuOpen}
      title={menuTitle}
      on:toggle={() => dispatch('toggleMenu')}
      on:close={() => dispatch('closeMenu')}
    >
      <slot name="menu">
        <MenuItem icon="icon-edit-alt" label={editLabel} on:select={() => dispatch('edit')} />
        <MenuItem icon="icon-trash-alt" label={deleteLabel} danger on:select={() => dispatch('delete')} />
      </slot>
    </PopoverMenu>
  </div>
</div>

<style>
  .entry-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .entry-title-bar__title-group {
    display: flex;
    align-items: center;
    gap: 0.18rem;
    min-width: 0;
    flex: 1;
  }

  .entry-title-bar__title-group :global(.entry-title) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-title-bar__actions {
    display: flex;
    align-items: center;
    gap: 0.18rem;
    flex-shrink: 0;
  }

</style>
