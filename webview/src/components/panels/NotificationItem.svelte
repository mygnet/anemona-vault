<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import { formatDate } from '../../utils/utils'

  export let notification: {
    id: string
    type: string
    title: string
    message: string
    priority: string
    createdAt: string
    status?: string
  }
  export let typeLabel = ''
  export let faded = false
  export let mode: 'inbox' | 'history' = 'inbox'

  const dispatch = createEventDispatcher<{
    open: string
    read: string
    unread: string
    delete: string
  }>()

  function priorityClass(priority: string): string {
    switch (priority) {
      case 'high': return 'prio-high'
      case 'normal': return 'prio-normal'
      default: return 'prio-low'
    }
  }
</script>

<div class="notification-card {priorityClass(notification.priority)}" class:notification-card--faded={faded}>
  <div class="notification-card__header">
    <span class="notification-card__type">{typeLabel || notification.type}</span>
    <span class="notification-card__date">{formatDate(notification.createdAt)}</span>
  </div>
  <div class="notification-card__title">{notification.title}</div>
  {#if notification.message}
    <div class="notification-card__message">{notification.message}</div>
  {/if}
  <div class="notification-card__actions">
    <button class="btn small primary" on:click={() => dispatch('open', notification.id)}>{$t('notificationPanel.open')}</button>
    {#if mode === 'inbox'}
      <button class="btn small" on:click={() => dispatch('read', notification.id)}>{$t('notificationPanel.read')}</button>
    {:else}
      <button class="btn small" on:click={() => dispatch('unread', notification.id)}>{$t('notificationPanel.unread')}</button>
      <button
        class="notification-card__delete-icon"
        on:click={() => dispatch('delete', notification.id)}
        title={$t('common.delete')}
        aria-label={$t('common.delete')}
      >
        <span class="anemona icon-trash-alt"></span>
      </button>
    {/if}
  </div>
</div>

<style>
  .notification-card {
    border: 1px solid var(--theme-editor-card-border);
    border-radius: var(--ui-radius-md);
    padding: 0.5rem 0.6rem;
    background: var(--theme-editor-card-bg);
  }

  .notification-card.notification-card--faded {
    opacity: 0.6;
  }

  .notification-card.prio-high {
    border-left: 3px solid var(--ui-danger);
  }

  .notification-card.prio-normal {
    border-left: 3px solid var(--ui-warning);
  }

  .notification-card.prio-low {
    border-left: 3px solid var(--theme-accent-readable);
  }

  .notification-card__header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 0.1rem 0.4rem;
    margin-bottom: 0.2rem;
  }

  .notification-card__type {
    font-size: var(--ui-font-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--theme-accent-text);
  }

  .notification-card__date {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
  }

  .notification-card__title {
    font-size: var(--ui-font-sm);
    font-weight: 500;
    line-height: 1.3;
    color: var(--theme-editor-title-text);
  }

  .notification-card__message {
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    margin-top: 0.1rem;
  }

  .notification-card__actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }

  .notification-card__delete-icon {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-danger-text);
    cursor: pointer;
    padding: 0;
    opacity: 0.82;
  }

  .notification-card__delete-icon:hover {
    opacity: 1;
    background: var(--ui-danger-bg);
    border-color: var(--ui-danger-border);
  }
</style>
