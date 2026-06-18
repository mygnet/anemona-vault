<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { SortDirection } from '../lib/sortUtils'

  export let value = ''
  export let placeholder = ''
  export let sortDirection: SortDirection = null
  export let showSort = false
  export let sortTitleAsc = ''
  export let sortTitleDesc = ''

  const dispatch = createEventDispatcher<{ input: string; toggleSort: void; clear: void }>()

  function handleInput(e: Event) {
    value = (e.target as HTMLInputElement).value
    dispatch('input', value)
  }

  function handleClear() {
    value = ''
    dispatch('input', '')
    dispatch('clear')
  }
</script>

<div class="editor-toolbar">
  <div class="search-field">
    <span class="search-icon anemona icon-search-alt"></span>
    <input
      class="toolbar-search"
      type="text"
      {placeholder}
      {value}
      on:input={handleInput}
    />
    {#if value}
      <button class="search-clear" on:click={handleClear} aria-label="Clear search">
        <span class="anemona icon-x"></span>
      </button>
    {/if}
  </div>
  {#if showSort}
    <button
      class="icon-btn sort-btn"
      on:click={() => dispatch('toggleSort')}
      title={sortDirection === 'asc' ? sortTitleDesc : sortTitleAsc}
    >
      <span class="anemona {sortDirection === 'asc' ? 'icon-sort-a-z' : 'icon-sort-z-a'}"></span>
    </button>
  {/if}
  <slot name="actions" />
</div>
