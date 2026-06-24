<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import FormModal from './FormModal.svelte'

  export let title = ''
  export let body = ''
  export let confirmLabel = ''
  export let cancelLabel = ''
  export let danger = false

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>()
</script>

<FormModal modalClass="delete-modal" {title} ariaLabel="Close" on:close={() => dispatch('cancel')}>
  <p>{body}</p>
  <svelte:fragment slot="actions">
    <button class="btn small" on:click={() => dispatch('cancel')}>{cancelLabel || $t('common.cancel')}</button>
    <button class="btn small" class:danger on:click={() => dispatch('confirm')}>
      {confirmLabel || $t('common.save')}
    </button>
  </svelte:fragment>
</FormModal>
