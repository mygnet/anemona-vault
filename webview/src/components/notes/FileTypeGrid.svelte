<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'

  export let value = 'md'

  const dispatch = createEventDispatcher<{ change: string }>()

  const options = [
    { value: 'md', icon: 'icon-file-text', label: 'notesList.typeText' },
    { value: 'key', icon: 'icon-key-solid', label: 'notesList.typeKey' },
    { value: 'command', icon: 'icon-terminal', label: 'notesList.typeCmd' },
    { value: 'link', icon: 'icon-link', label: 'notesList.typeLink' },
    { value: 'todo', icon: 'icon-list-todo', label: 'notesList.typeTodo' },
    { value: 'snippet', icon: 'icon-code-xml', label: 'notesList.typeSnip' },
    { value: 'reminder', icon: 'icon-alarm-clock', label: 'notesList.typeRemind' },
    { value: 'shot', icon: 'icon-image', label: 'notesList.typeShot' },
    { value: 'folder', icon: 'icon-folder', label: 'notesList.typeFolder' },
  ]

  function select(nextValue: string) {
    value = nextValue
    dispatch('change', value)
  }
</script>

<div class="type-grid">
  {#each options as option}
    <button
      class="type-option"
      class:active={value === option.value}
      on:click={() => select(option.value)}
      title={$t(option.label)}
    >
      <span class="type-option-icon anemona {option.icon}"></span>
      <span class="type-option-label">{$t(option.label)}</span>
    </button>
  {/each}
</div>

<style>
  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(4.2rem, 1fr));
    gap: 0.3rem;
  }

  .type-option {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.26rem;
    padding: 0.2rem 0.36rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }

  .type-option:hover {
    background: var(--ui-hover);
    border-color: var(--theme-accent-border-hover);
  }

  .type-option.active {
    background: var(--ui-active);
    border-color: var(--theme-accent-border-strong);
  }

  .type-option-icon {
    font-size: 0.82rem;
    opacity: 0.75;
    line-height: 1;
  }

  .type-option.active .type-option-icon {
    opacity: 1;
  }

  .type-option-label {
    font-size: var(--ui-font-xs);
    line-height: 1;
    opacity: 0.75;
  }

  .type-option.active .type-option-label {
    opacity: 1;
  }
</style>
