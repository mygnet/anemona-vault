<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export type FilterChipOption = {
    value: string
    label: string
    icon?: string
  }

  export let options: FilterChipOption[] = []
  export let value = ''

  const dispatch = createEventDispatcher<{ change: string }>()
</script>

<div class="filter-row">
  {#each options as option}
    <button
      class="filter-chip"
      class:active={value === option.value}
      on:click={() => dispatch('change', option.value)}
    >
      {#if option.icon}
        <span class="anemona {option.icon}"></span>
      {/if}
      {option.label}
    </button>
  {/each}
</div>
