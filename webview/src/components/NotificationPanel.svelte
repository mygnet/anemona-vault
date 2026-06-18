<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../i18n'
  import { formatDate } from '../lib/utils'

  const dispatch = createEventDispatcher<{
    close: void
    read: string
    unread: string
    delete: string
    open: string
    tabChange: 'inbox' | 'history'
    loadMore: void
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



  function priorityClass(priority: string): string {
    switch (priority) {
      case 'high': return 'prio-high'
      case 'normal': return 'prio-normal'
      default: return 'prio-low'
    }
  }
</script>

<div class="notification-panel">
  <div class="panel-header">
    <button class="icon-btn back-btn" on:click={() => dispatch('close')} title={$t('notificationPanel.back')}
      ><span class="anemona icon-chevron-left"></span></button
    >
    <span class="panel-title">{$t('notificationPanel.title')}</span>
  </div>

  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'inbox'}
      on:click={() => dispatch('tabChange', 'inbox')}>
      {$t('notificationPanel.inbox')}
      {#if notifications.length > 0}
        <span class="tab-count">{notifications.length}</span>
      {/if}
    </button>
    <button
      class="tab"
      class:active={activeTab === 'history'}
      on:click={() => dispatch('tabChange', 'history')}>
      {$t('notificationPanel.history')}
      {#if historyIndex}
        <span class="tab-count">{historyIndex.totalNotifications}</span>
      {:else if history.length > 0}
        <span class="tab-count">{history.length}</span>
      {/if}
    </button>
  </div>

  <div class="panel-body" bind:this={historyScroll} on:scroll={handleHistoryScroll}>
    {#if activeTab === 'inbox'}
      {#if notifications.length === 0}
        <div class="empty-state">
          <span class="anemona icon-bell" style="font-size: 2rem; opacity: 0.4;"></span>
          <p>{$t('notificationPanel.inboxEmpty')}</p>
        </div>
      {:else}
        <div class="notif-list">
          {#each notifications as n}
            <div class="notif-item {priorityClass(n.priority)}">
              <div class="notif-header">
                <span class="notif-type-label">{typeLabelMap[n.type] || n.type}</span>
                <span class="notif-date">{formatDate(n.createdAt)}</span>
              </div>
              <div class="notif-title">{n.title}</div>
              {#if n.message}
                <div class="notif-msg">{n.message}</div>
              {/if}
              <div class="notif-actions">
                <button class="notif-btn primary" on:click={() => dispatch('open', n.id)}>{$t('notificationPanel.open')}</button>
                <button class="notif-btn" on:click={() => dispatch('read', n.id)}>{$t('notificationPanel.read')}</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      {#if history.length === 0}
        <div class="empty-state">
          <span class="anemona icon-history" style="font-size: 2rem; opacity: 0.4;"></span>
          <p>{$t('notificationPanel.historyEmpty')}</p>
        </div>
      {:else}
        <div class="notif-list">
          {#each history as n}
            <div class="notif-item faded {priorityClass(n.priority)}">
              <div class="notif-header">
                <span class="notif-type-label">{typeLabelMap[n.type] || n.type}</span>
                <span class="notif-date">{formatDate(n.createdAt)}</span>
              </div>
              <div class="notif-title">{n.title}</div>
              {#if n.message}
                <div class="notif-msg">{n.message}</div>
              {/if}
              <div class="notif-actions">
                <button class="notif-btn primary" on:click={() => dispatch('open', n.id)}>{$t('notificationPanel.open')}</button>
                <button class="notif-btn" on:click={() => dispatch('unread', n.id)}>{$t('notificationPanel.unread')}</button>
                <button class="notif-btn danger" on:click={() => confirmDelete(n.id)}>{$t('common.delete')}</button>
              </div>
            </div>
          {/each}
        </div>
        {#if hasMore}
          <div class="load-more-hint">{$t('notificationPanel.scrollForMore')}</div>
        {/if}
      {/if}
    {/if}
  </div>
</div>

{#if deleteConfirmId}
  <button class="delete-modal-backdrop" on:click={cancelDelete} aria-label="Close"></button>
  <div class="delete-modal">
    <h3>{$t('common.delete')}</h3>
    <p>{$t('notificationPanel.deleteConfirm')}</p>
    <div class="delete-modal-actions">
      <button class="notif-btn" on:click={cancelDelete}>{$t('common.cancel')}</button>
      <button class="notif-btn danger" on:click={executeDelete}>{$t('common.delete')}</button>
    </div>
  </div>
{/if}

<style>
  .notification-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--ui-border);
    flex-shrink: 0;
  }

  .panel-title {
    font-weight: 600;
    font-size: var(--ui-font-md);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--ui-border);
    flex-shrink: 0;
  }

  .tab {
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

  .tab.active {
    color: var(--vscode-foreground);
    border-bottom-color: var(--vscode-textLink-foreground);
  }

  .tab:hover {
    color: var(--vscode-foreground);
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--ui-soft-2);
    color: var(--ui-muted);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
  }

  .tab.active .tab-count {
    background: var(--vscode-textLink-foreground);
    color: #fff;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.4rem 0.6rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 100%;
    color: var(--ui-muted);
  }

  .notif-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .notif-item {
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-md);
    padding: 0.5rem 0.6rem;
    background: var(--ui-soft);
  }

  .notif-item.faded {
    opacity: 0.6;
  }

  .notif-item.prio-high {
    border-left: 3px solid #c0392b;
  }

  .notif-item.prio-normal {
    border-left: 3px solid #f5a623;
  }

  .notif-item.prio-low {
    border-left: 3px solid var(--vscode-textLink-foreground);
  }

  .notif-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.2rem;
  }

  .notif-type-label {
    font-size: var(--ui-font-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .notif-date {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
  }

  .notif-title {
    font-size: var(--ui-font-sm);
    font-weight: 500;
    line-height: 1.3;
  }

  .notif-msg {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    margin-top: 0.1rem;
  }

  .notif-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }

  .notif-btn {
    font-size: var(--ui-font-xs);
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    transition: background 0.12s;
  }

  .notif-btn:hover {
    background: var(--ui-soft-2);
  }

  .notif-btn.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: transparent;
  }

  .notif-btn.primary:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .load-more-hint {
    text-align: center;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    padding: 0.5rem;
    opacity: 0.6;
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem;
    color: var(--vscode-foreground);
    font-size: 1rem;
    line-height: 1;
    border-radius: var(--ui-radius-sm);
    transition: background 0.12s;
  }

  .icon-btn:hover {
    background: var(--ui-soft-2);
  }

  .notif-btn.danger {
    border-color: #c0392b;
    color: #c0392b;
  }

  .notif-btn.danger:hover {
    background: #c0392b;
    color: #fff;
  }

  .delete-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(260px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .delete-modal h3 {
    margin: 0 0 0.4rem;
    font-size: var(--ui-font-md);
    font-weight: 600;
  }

  .delete-modal p {
    margin: 0 0 0.75rem;
    font-size: var(--ui-font-sm);
    color: var(--ui-muted);
  }

  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
</style>
