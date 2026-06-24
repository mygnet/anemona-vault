<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { t } from '../../i18n'
  import FormModal from '../ui/FormModal.svelte'

  export let value = ''

  let input: HTMLInputElement

  const dispatch = createEventDispatcher<{ save: void; cancel: void }>()

  onMount(async () => {
    await tick()
    input?.focus()
  })
</script>

<FormModal modalClass="add-modal" title={$t('notesList.renameFolderTitle')} ariaLabel={$t('common.close')} on:close={() => dispatch('cancel')}>
  <input
    class="modal-field"
    type="text"
    placeholder={$t('notesList.renameFolderPlaceholder')}
    bind:this={input}
    bind:value
    on:keydown={(event) => event.key === 'Enter' && dispatch('save')}
  />
  <svelte:fragment slot="actions">
    <button class="btn" on:click={() => dispatch('cancel')}>{$t('common.cancel')}</button>
    <button class="btn primary" on:click={() => dispatch('save')}>{$t('common.save')}</button>
  </svelte:fragment>
</FormModal>
