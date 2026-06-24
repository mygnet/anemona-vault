<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import ConfirmModal from '../ui/ConfirmModal.svelte'
  import MenuItem from '../ui/MenuItem.svelte'
  import NotificationItem from './NotificationItem.svelte'
  import PopoverMenu from '../ui/PopoverMenu.svelte'

  const dispatch = createEventDispatcher<{
    close: void
    read: string
    unread: string
    delete: string
    open: string
    tabChange: 'inbox' | 'history'
    loadMore: void
    color: void
  }>()

  export let notifications: {
    id: string
    type: string
    title: string
    message: string
    priority: string
    createdAt: string
  }[] = []

  export let history: {
    id: string
    type: string
    title: string
    message: string
    priority: string
    createdAt: string
    status: string
  }[] = []

  export let activeTab: 'inbox' | 'history' = 'inbox'

  export let historyIndex: { version: number; pageSize: number; currentPage: number; totalPages: number; totalNotifications: number } | null = null

  export let onLoadMore: (() => void) | null = null

  let menuOpen = false

  let historyScroll: HTMLDivElement
  let hasMore = true

  $: {
    if (historyIndex && historyLoadedAtLeastOnePage) {
      hasMore = historyIndex.totalPages > 1
    }
  }

  let historyLoadedAtLeastOnePage = false
  let deleteConfirmId: string | null = null

  function confirmDelete(id: string) {
    deleteConfirmId = id
  }

  function cancelDelete() {
    deleteConfirmId = null
  }

  function executeDelete() {
    if (deleteConfirmId) {
      dispatch('delete', deleteConfirmId)
      deleteConfirmId = null
    }
  }

  function handleHistoryScroll() {
    if (!historyScroll || !hasMore || !onLoadMore) return
    const atBottom = historyScroll.scrollHeight - historyScroll.scrollTop - historyScroll.clientHeight < 80
    if (atBottom) {
      historyLoadedAtLeastOnePage = true
      onLoadMore()
    }
  }

  $: typeLabelMap = {
    task_due_soon: $t('notificationPanel.typeDueSoon'),
    task_overdue: $t('notificationPanel.typeOverdue'),
    task_due: $t('notificationPanel.typeTaskDue'),
    reminder: $t('notificationPanel.typeReminder'),
    system: $t('notificationPanel.typeAnemona'),
  }

</script>

<div class="notification-panel">
  <div class="notification-panel__header">
    <button class="icon-btn back-btn" on:click={() => dispatch('close')} title={$t('notificationPanel.back')}
      ><span class="anemona icon-chevron-left"></span></button
    >
    <span class="notification-panel__title">{$t('notificationPanel.title')}</span>
    <div class="notification-panel__actions">
      <PopoverMenu
        open={menuOpen}
        triggerClass="icon-btn menu-trigger"
        title={$t('notificationPanel.options')}
        on:toggle={() => menuOpen = !menuOpen}
        on:close={() => menuOpen = false}
      >
        <MenuItem icon="icon-color-fill" label={$t('notesList.color')} on:select={() => { menuOpen = false; dispatch('color') }} />
      </PopoverMenu>
    </div>
  </div>

  <div class="notification-panel__tabs">
    <button
      class="notification-panel__tab"
      class:active={activeTab === 'inbox'}
      on:click={() => dispatch('tabChange', 'inbox')}>
      {$t('notificationPanel.inbox')}
      {#if notifications.length > 0}
        <span class="notification-panel__tab-count ui-badge count">{notifications.length}</span>
      {/if}
    </button>
    <button
      class="notification-panel__tab"
      class:active={activeTab === 'history'}
      on:click={() => dispatch('tabChange', 'history')}>
      {$t('notificationPanel.history')}
      {#if historyIndex}
        <span class="notification-panel__tab-count ui-badge count">{historyIndex.totalNotifications}</span>
      {:else if history.length > 0}
        <span class="notification-panel__tab-count ui-badge count">{history.length}</span>
      {/if}
    </button>
  </div>

  <div class="notification-panel__body" bind:this={historyScroll} on:scroll={handleHistoryScroll}>
    {#if activeTab === 'inbox'}
      {#if notifications.length === 0}
        <div class="notification-panel__empty">
          <span class="anemona icon-bell" style="font-size: 2rem; opacity: 0.4;"></span>
          <p>{$t('notificationPanel.inboxEmpty')}</p>
        </div>
      {:else}
        <div class="notification-panel__list">
          {#each notifications as n}
            <NotificationItem
              notification={n}
              typeLabel={typeLabelMap[n.type] || n.type}
              mode="inbox"
              on:open={(event) => dispatch('open', event.detail)}
              on:read={(event) => dispatch('read', event.detail)}
            />
          {/each}
        </div>
      {/if}
    {:else}
      {#if history.length === 0}
        <div class="notification-panel__empty">
          <span class="anemona icon-history" style="font-size: 2rem; opacity: 0.4;"></span>
          <p>{$t('notificationPanel.historyEmpty')}</p>
        </div>
      {:else}
        <div class="notification-panel__list">
          {#each history as n}
            <NotificationItem
              notification={n}
              typeLabel={typeLabelMap[n.type] || n.type}
              mode="history"
              faded={true}
              on:open={(event) => dispatch('open', event.detail)}
              on:unread={(event) => dispatch('unread', event.detail)}
              on:delete={(event) => confirmDelete(event.detail)}
            />
          {/each}
        </div>
        {#if hasMore}
          <div class="notification-panel__load-more">{$t('notificationPanel.scrollForMore')}</div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

{#if deleteConfirmId}
  <ConfirmModal
    title={$t('common.delete')}
    body={$t('notificationPanel.deleteConfirm')}
    confirmLabel={$t('common.delete')}
    danger={true}
    on:confirm={executeDelete}
    on:cancel={cancelDelete}
  />
{/if}

<style>
  .notification-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .notification-panel__header {
    display: flex;
    align-items: center;
    gap: var(--theme-section-header-gap);
    padding: var(--theme-section-header-pad-y) var(--theme-section-header-pad-x) var(--theme-section-header-pad-bottom);
    background: var(--theme-section-header-bg);
    border-bottom: 1px solid var(--theme-section-header-border);
    flex-shrink: 0;
  }

  .notification-panel__title {
    font-weight: 400;
    font-size: var(--ui-font-title);
    color: var(--theme-section-header-title);
  }

  .notification-panel__actions {
    margin-left: auto;
  }

  .notification-panel__tabs {
    display: flex;
    border-bottom: 1px solid var(--ui-border);
    flex-shrink: 0;
  }

  .notification-panel__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.35rem 0.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--ui-muted);
    font-size: var(--ui-font-sm);
    font-weight: 500;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }

  .notification-panel__tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--theme-accent-text);
  }

  .notification-panel__tab:hover {
    color: var(--vscode-foreground);
  }

  .notification-panel__tab.active .notification-panel__tab-count {
    background: var(--theme-notifications-badge-bg);
    border: 1px solid var(--theme-notifications-badge-border);
    color: var(--theme-notifications-badge-text);
  }

  .notification-panel__body {
    flex: 1;
    overflow-y: auto;
    padding: 0.4rem 0.6rem;
  }

  .notification-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    color: var(--ui-muted);
  }

  .notification-panel__list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .notification-panel__load-more {
    text-align: center;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    padding: 0.5rem;
    opacity: 0.6;
  }

</style>
