<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../i18n'
  import SearchToolbar from '../lib/SearchToolbar.svelte'
  import type { SortDirection } from '../lib/sortUtils'

  export let query = ''
  export let loading = false
  export let results: {
    category: string
    noteName: string
    filePath: string
    fileType: 'md' | 'key' | 'command' | 'todo'
    displayName: string
    matchLabel: string
    snippet: string
  }[] = []

  const dispatch = createEventDispatcher<{
    close: void
    search: string
    open: (typeof results)[number]
  }>()

  let localQuery = query
  let lastQueryProp = query
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let sortDirection: SortDirection = null

  $: if (query !== lastQueryProp) {
    localQuery = query
    lastQueryProp = query
  }

  function scheduleSearch(value: string) {
    localQuery = value
    if (searchTimer) clearTimeout(searchTimer)

    searchTimer = setTimeout(() => {
      dispatch('search', localQuery)
    }, 180)
  }

  function handleInput(event: Event) {
    scheduleSearch((event.currentTarget as HTMLInputElement).value)
  }

  function handleClear() {
    scheduleSearch('')
  }

  function toggleSort() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
  }

  $: sortedResults = sortDirection
    ? [...results].sort((a, b) => {
        const cmp = a.displayName.localeCompare(b.displayName)
        return sortDirection === 'asc' ? cmp : -cmp
      })
    : results

  function focus(node: HTMLInputElement) {
    node.focus()
    return {}
  }

  function getTypeLabel(fileType: string): string {
    if (fileType === 'key') return $t('searchPanel.typeKeys')
    if (fileType === 'command') return $t('searchPanel.typeCommands')
    if (fileType === 'todo') return $t('searchPanel.typeTasks')
    return $t('searchPanel.typeDocument')
  }
</script>

<div class="search-panel">
  <div class="panel-header">
    <button class="icon-btn" on:click={() => dispatch('close')} title={$t('searchPanel.back')}><span class="anemona icon-arrow-back"></span></button>
    <span class="panel-title">{$t('searchPanel.title')}</span>
  </div>

  <div class="search-toolbar">
    <SearchToolbar
      value={localQuery}
      placeholder={$t('searchPanel.placeholder')}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t('searchPanel.sortAscending')}
      sortTitleDesc={$t('searchPanel.sortDescending')}
      on:input={(e) => scheduleSearch(e.detail)}
      on:toggleSort={toggleSort}
      on:clear={handleClear}
    />
  </div>

  <div class="results-list">
    {#if !localQuery.trim()}
      <div class="empty-state">{$t('searchPanel.empty')}</div>
    {:else if loading}
      <div class="empty-state">{$t('searchPanel.searching')}</div>
    {:else if results.length === 0}
      <div class="empty-state">{$t('searchPanel.noResults')}</div>
    {:else}
      {#each sortedResults as result}
        <button class="result-card" on:click={() => dispatch('open', result)}>
          <div class="result-topline">
            <span class="result-file">{result.displayName}</span>
            <span class="result-type">{getTypeLabel(result.fileType)}</span>
          </div>
          <div class="result-meta">{result.category} / {result.matchLabel}</div>
          <div class="result-snippet">{result.snippet}</div>
        </button>
      {/each}
    {/if}
  </div>
</div>

<style>
  .search-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.18rem;
    box-sizing: border-box;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.22rem;
    padding: 0.2rem 0.24rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 14%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
    flex-shrink: 0;
  }

  .panel-title {
    flex: 1;
    font-size: var(--ui-font-title);
    color: var(--vscode-sideBarTitle-foreground);
  }

  .search-toolbar {
    margin-top: 0.18rem;
    flex-shrink: 0;
  }

  .results-list {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.18rem;
  }

  .result-card {
    width: 100%;
    text-align: left;
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(in srgb, var(--accent-color) 4%, var(--vscode-editor-background));
    color: var(--vscode-foreground);
    padding: var(--ui-card-pad-y) calc(var(--ui-card-pad-x) + 0.06rem);
    margin-bottom: 0.18rem;
    cursor: pointer;
  }

  .result-card:hover {
    border-color: color-mix(in srgb, var(--accent-color) 24%, transparent);
    background: color-mix(in srgb, var(--accent-color) 6%, var(--vscode-editor-background));
  }

  .result-topline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.3rem;
  }

  .result-file {
    font-size: var(--ui-font-entry);
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-type,
  .result-meta {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
  }

  .result-snippet {
    margin-top: 0.14rem;
    font-size: var(--ui-font-control);
    line-height: 1.35;
    color: var(--vscode-editor-foreground);
  }

  .empty-state {
    padding: 0.72rem 0.58rem;
    border: 1px dashed color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    color: var(--ui-muted);
    text-align: center;
    font-size: var(--ui-font-sm);
    background: color-mix(in srgb, var(--accent-color) 4%, transparent);
  }

</style>
