<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import SearchToolbar from '../ui/SearchToolbar.svelte'
  import { nextSortDirection, type SortDirection } from '../../utils/sortUtils'

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

  function toggleSort() {
    sortDirection = nextSortDirection(sortDirection)
  }

  $: sortedResults = sortDirection
    ? [...results].sort((a, b) => {
        const cmp = a.displayName.localeCompare(b.displayName)
        return sortDirection === 'asc' ? cmp : -cmp
      })
    : results

  function getTypeLabel(fileType: string): string {
    if (fileType === 'key') return $t('searchPanel.typeKeys')
    if (fileType === 'command') return $t('searchPanel.typeCommands')
    if (fileType === 'todo') return $t('searchPanel.typeTasks')
    return $t('searchPanel.typeDocument')
  }
</script>

<div class="search-panel">
  <div class="search-panel__header ui-card">
    <button class="icon-btn" on:click={() => dispatch('close')} title={$t('searchPanel.back')}><span class="anemona icon-chevron-left"></span></button>
    <span class="search-panel__title">{$t('searchPanel.title')}</span>
  </div>

  <div class="search-panel__toolbar">
    <SearchToolbar
      value={localQuery}
      placeholder={$t('searchPanel.placeholder')}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t('searchPanel.sortAscending')}
      sortTitleDesc={$t('searchPanel.sortDescending')}
      on:input={(e) => scheduleSearch(e.detail)}
      on:toggleSort={toggleSort}
    />
  </div>

  <div class="search-panel__results">
    {#if !localQuery.trim()}
      <div class="ui-empty">{$t('searchPanel.empty')}</div>
    {:else if loading}
      <div class="ui-empty">{$t('searchPanel.searching')}</div>
    {:else if results.length === 0}
      <div class="ui-empty">{$t('searchPanel.noResults')}</div>
    {:else}
      {#each sortedResults as result}
        <button class="search-result ui-card interactive" on:click={() => dispatch('open', result)}>
          <div class="search-result__topline">
            <span class="search-result__file">{result.displayName}</span>
            <span class="search-result__type">{getTypeLabel(result.fileType)}</span>
          </div>
          <div class="search-result__meta">{result.category} / {result.matchLabel}</div>
          <div class="search-result__snippet">{result.snippet}</div>
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

  .search-panel__header {
    display: flex;
    align-items: center;
    gap: var(--theme-section-header-gap);
    padding: var(--theme-section-header-pad-y) var(--theme-section-header-pad-x) var(--theme-section-header-pad-bottom);
    flex-shrink: 0;
    border: 0;
    border-bottom: 1px solid var(--theme-section-header-border);
    border-radius: 0;
    background: var(--theme-section-header-bg);
    margin: -0.18rem -0.18rem 0.16rem;
  }

  .search-panel__title {
    flex: 1;
    font-size: var(--ui-font-title);
    color: var(--theme-section-header-title);
  }

  .search-panel__toolbar {
    margin-top: 0.18rem;
    flex-shrink: 0;
  }

  .search-panel__results {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.18rem;
  }

  .search-result {
    width: 100%;
    text-align: left;
    padding: var(--ui-card-pad-y) calc(var(--ui-card-pad-x) + 0.06rem);
    margin-bottom: 0.18rem;
  }

  .search-result__topline {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.3rem;
  }

  .search-result__file {
    font-size: var(--ui-font-entry);
    color: var(--theme-accent-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-result__type,
  .search-result__meta {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
  }

  .search-result__snippet {
    margin-top: 0.14rem;
    font-size: var(--ui-font-control);
    line-height: 1.35;
    color: var(--vscode-editor-foreground);
  }

</style>
