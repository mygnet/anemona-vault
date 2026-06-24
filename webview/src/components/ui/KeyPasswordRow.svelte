<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let password = ''
  export let maskedPassword = ''
  export let copied = false
  export let visible = false
  export let canExpand = false
  export let expanded = false
  export let copyTitle = ''
  export let showTitle = ''
  export let hideTitle = ''
  export let expandTitle = ''
  export let collapseTitle = ''

  const dispatch = createEventDispatcher<{
    copy: void
    toggleVisibility: void
    toggleExpand: void
  }>()

  function handleKeydown(event: KeyboardEvent, action: 'copy' | 'toggleVisibility' | 'toggleExpand') {
    if (event.key !== 'Enter') return
    dispatch(action)
  }
</script>

<div class="key-password-row">
  <span
    class="icon-action"
    role="button"
    tabindex="0"
    on:click|stopPropagation={() => dispatch('copy')}
    on:keydown={(event) => handleKeydown(event, 'copy')}
    title={copyTitle}
  >
    <span class={`anemona ${copied ? 'icon-check' : 'icon-copy'}`}></span>
  </span>
  <span
    class="icon-action"
    role="button"
    tabindex="0"
    on:click|stopPropagation={() => dispatch('toggleVisibility')}
    on:keydown={(event) => handleKeydown(event, 'toggleVisibility')}
    title={visible ? hideTitle : showTitle}
  >
    <span class={`anemona ${visible ? 'icon-hide' : 'icon-show'}`}></span>
  </span>
  <span class="key-password-row__value">{visible ? password : maskedPassword}</span>
  {#if canExpand}
    <span
      class="icon-action key-password-row__expand-action"
      role="button"
      tabindex="0"
      on:click|stopPropagation={() => dispatch('toggleExpand')}
      on:keydown={(event) => handleKeydown(event, 'toggleExpand')}
      title={expanded ? collapseTitle : expandTitle}
    >
      <span class={`anemona ${expanded ? 'icon-chevron-up' : 'icon-chevron-down'}`}></span>
    </span>
  {/if}
</div>

<style>
  .key-password-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.1rem;
    min-width: 0;
  }

  .key-password-row__value {
    font-size: var(--ui-font-xs);
    color: var(--vscode-descriptionForeground);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.14em;
    flex: 1;
  }

  .key-password-row__expand-action {
    margin-left: auto;
  }
</style>
