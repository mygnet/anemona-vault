<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { getDisplayName, getFileIconClass } from '../../utils/fileUtils'
  import { t } from '../../i18n'
  import MenuItem from '../ui/MenuItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

  export let noteName = ''
  export let showFileMenu = false
  export let onRename: (() => void) | null = null
  export let onMove: (() => void) | null = null
  export let onImport: (() => void) | null = null
  export let onExport: (() => void) | null = null
  export let onDelete: (() => void) | null = null

  const dispatch = createEventDispatcher<{ back: void }>()
  let fileMenuOpen = false

  $: displayName = getDisplayName(noteName)
  $: iconClass = getFileIconClass(noteName)

  function runAction(action: (() => void) | null) {
    fileMenuOpen = false
    action?.()
  }
</script>

<div class="editor-header">
  <button class="icon-btn" on:click={() => dispatch('back')} title={$t('common.back')}
    ><span class="anemona icon-chevron-left"></span></button
  >
  <span class="editor-header__title"><span class="editor-header__icon anemona {iconClass}"></span>{displayName}</span>
  <div class="editor-header__actions">
    <slot />
    {#if showFileMenu}
      <PopoverMenu
        open={fileMenuOpen}
        triggerClass="icon-btn menu-trigger"
        title={$t('notesList.fileOptions')}
        on:toggle={() => fileMenuOpen = !fileMenuOpen}
        on:close={() => fileMenuOpen = false}
      >
        <MenuItem icon="icon-edit-alt" label={$t('notesList.rename')} on:select={() => runAction(onRename)} />
        <MenuItem icon="icon-move" label={$t('notesList.moveTo')} on:select={() => runAction(onMove)} />
        <MenuItem icon="icon-import" label={$t('notesList.import')} on:select={() => runAction(onImport)} />
        <MenuItem icon="icon-export" label={$t('notesList.export')} on:select={() => runAction(onExport)} />
        <MenuItem icon="icon-trash-alt" label={$t('notesList.delete')} danger on:select={() => runAction(onDelete)} />
      </PopoverMenu>
    {/if}
  </div>
</div>

<style>
  .editor-header {
    display: flex;
    align-items: center;
    gap: var(--theme-section-header-gap);
    padding: var(--theme-section-header-pad-y) var(--theme-section-header-pad-x) var(--theme-section-header-pad-bottom);
    flex-shrink: 0;
    border: 0;
    border-bottom: 1px solid var(--theme-section-header-border);
    border-radius: 0;
    background: var(--theme-section-header-bg);
    margin: -0.26rem -0.26rem 0.16rem;
  }

  .editor-header__actions {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }
</style>
