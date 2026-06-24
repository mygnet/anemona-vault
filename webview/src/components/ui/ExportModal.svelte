<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { t } from '../../i18n'
  import FormModal from './FormModal.svelte'

  export let noteName = ''
  export let formats: { label: string; value: string }[] = []
  export let selectedFormat = ''

  const dispatch = createEventDispatcher<{ save: void; cancel: void }>()
</script>

<FormModal modalClass="delete-modal" title={$t('app.exportModalTitle')} ariaLabel="Close export dialog" on:close={() => dispatch('cancel')}>
  <p>{$t('app.exportModalBody', { name: noteName })}</p>
  <div class="form-options">
    {#each formats as format}
      <label class="form-option">
        <input type="radio" bind:group={selectedFormat} value={format.value} />
        <span>{format.label}</span>
      </label>
    {/each}
  </div>
  <svelte:fragment slot="actions">
    <button class="btn" on:click={() => dispatch('cancel')}>{$t('common.cancel')}</button>
    <button class="btn primary" on:click={() => dispatch('save')}>{$t('app.exportButton')}</button>
  </svelte:fragment>
</FormModal>

<style>
  .form-options {
    display: flex;
    flex-direction: column;
    gap: 0.36rem;
    margin-bottom: 0.6rem;
  }

  .form-option {
    display: flex;
    align-items: center;
    gap: 0.36rem;
    cursor: pointer;
    font-size: var(--ui-font-sm);
  }
</style>
