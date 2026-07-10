<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import MenuItem from '../ui/MenuItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

  export let selectedCategory = ''
  export let currentFolderName = ''
  export let isFolderContext = false
  export let canDeleteCategory = false
  export let canDeleteFolder = false
  export let canGoBack = false
  export let menuOpen = false

  const dispatch = createEventDispatcher<{
    back: void
    add: void
    toggleMenu: void
    closeMenu: void
    rename: void
    delete: void
    color: void
    folderRename: void
    folderMove: void
    folderDelete: void
    folderColor: void
  }>()

  $: title = isFolderContext ? currentFolderName : selectedCategory
</script>

<div class="header">
  <div class="title-row">
    {#if canGoBack}
      <button class="icon-btn back-btn" on:click={() => dispatch('back')} title={$t('common.back')}>
        <span class="anemona icon-arrow-back"></span>
      </button>
    {/if}
    <span class="title">{title}</span>
  </div>
  <div class="header-actions">
    <button class="icon-btn primary-action" on:click={() => dispatch('add')} title={$t('notesList.addFile')}>
      <span class="anemona icon-plus"></span>
    </button>
    <PopoverMenu
      open={menuOpen}
      triggerClass="icon-btn menu-trigger"
      title={isFolderContext ? $t('notesList.folderOptions') : $t('notesList.categoryOptions')}
      on:toggle={() => dispatch('toggleMenu')}
      on:close={() => dispatch('closeMenu')}
    >
      {#if isFolderContext}
        <MenuItem icon="icon-edit-alt" label={$t('notesList.rename')} on:select={() => dispatch('folderRename')} />
        <MenuItem icon="icon-move" label={$t('notesList.moveTo')} on:select={() => dispatch('folderMove')} />
        <MenuItem icon="icon-color-fill" label={$t('notesList.color')} on:select={() => dispatch('folderColor')} />
        {#if canDeleteFolder}
          <MenuItem icon="icon-trash-alt" label={$t('notesList.delete')} danger on:select={() => dispatch('folderDelete')} />
        {/if}
      {:else}
        <MenuItem icon="icon-edit-alt" label={$t('notesList.rename')} on:select={() => dispatch('rename')} />
        {#if canDeleteCategory}
          <MenuItem icon="icon-trash-alt" label={$t('notesList.delete')} danger on:select={() => dispatch('delete')} />
        {/if}
        <MenuItem icon="icon-color-fill" label={$t('notesList.color')} on:select={() => dispatch('color')} />
      {/if}
    </PopoverMenu>
  </div>
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--theme-section-header-pad-y) var(--theme-section-header-pad-x) var(--theme-section-header-pad-bottom);
    flex-shrink: 0;
    background: var(--theme-section-header-bg);
    border-bottom: 1px solid var(--theme-section-header-border);
    margin: -0.12rem -0.18rem 0.16rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--theme-section-header-gap);
    min-width: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--theme-section-header-gap);
  }

  .title {
    font-size: var(--ui-font-title);
    font-weight: 400;
    color: var(--theme-section-header-title);
    opacity: 0.95;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .primary-action {
    color: var(--theme-section-header-title);
  }
</style>
