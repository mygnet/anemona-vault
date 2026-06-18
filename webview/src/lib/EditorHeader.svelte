<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { getDisplayName, getFileIconClass } from '../lib/fileUtils'
  import { t } from '../i18n'

  export let noteName = ''

  const dispatch = createEventDispatcher<{ back: void }>()

  $: displayName = getDisplayName(noteName)
  $: iconClass = getFileIconClass(noteName)
</script>

<div class="editor-header">
  <button class="icon-btn" on:click={() => dispatch('back')} title={$t('common.back')}
    ><span class="anemona icon-arrow-back"></span></button
  >
  <span class="note-title"><span class="note-icon anemona {iconClass}"></span>{displayName}</span>
  <div class="header-actions">
    <slot />
  </div>
</div>

<style>
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }
</style>
