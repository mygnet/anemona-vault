<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import FormModal from './FormModal.svelte'

  type Category = { name: string }
  type FolderNode = { name: string; path: string; children?: FolderNode[] }

  export let title = ''
  export let body = ''
  export let categories: Category[] = []
  export let moveFolderTree: FolderNode[] = []
  export let selectedCategory = ''
  export let selectedFolder = ''
  export let excludeFolder = ''

  const dispatch = createEventDispatcher<{ save: void; cancel: void; categoryChange: void }>()

  $: availableCategories = categories

  function isExcluded(value: string): boolean {
    if (!excludeFolder) return false
    return value === excludeFolder || value.startsWith(excludeFolder + '/')
  }

  function flattenTree(nodes: FolderNode[], prefix = ''): { value: string; label: string; depth: number }[] {
    const result: { value: string; label: string; depth: number }[] = []
    for (const node of nodes) {
      const value = prefix ? prefix + '/' + node.name : node.name
      if (!isExcluded(value)) {
        result.push({ value, label: node.name, depth: prefix ? prefix.split('/').length : 0 })
        if (node.children) {
          result.push(...flattenTree(node.children, value))
        }
      }
    }
    return result
  }

  $: flatOptions = flattenTree(moveFolderTree)
</script>

<FormModal modalClass="delete-modal" {title} ariaLabel="Close move dialog" on:close={() => dispatch('cancel')}>
  <p>{body}</p>
  <label class="field-label" for="move-category-select">{$t('app.moveCategoryLabel')}</label>
  <select
    id="move-category-select"
    class="form-input"
    bind:value={selectedCategory}
    on:change={() => dispatch('categoryChange')}
  >
    {#each availableCategories as category}
      <option value={category.name}>{category.name}</option>
    {/each}
  </select>
  <label class="field-label" for="move-folder-select">{$t('app.moveFolderLabel')}</label>
  <select id="move-folder-select" class="form-input" bind:value={selectedFolder}>
    <option value="">{$t('app.moveRootOption')}</option>
    {#each flatOptions as opt}
      <option value={opt.value}>{'—'.repeat(opt.depth + 1)} {opt.label}</option>
    {/each}
  </select>
  <svelte:fragment slot="actions">
    <button class="btn" on:click={() => dispatch('cancel')}>{$t('common.cancel')}</button>
    <button class="btn primary" on:click={() => dispatch('save')}>{$t('common.move')}</button>
  </svelte:fragment>
</FormModal>
