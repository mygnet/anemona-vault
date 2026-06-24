<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { t } from '../../i18n'
  import FileTypeGrid from './FileTypeGrid.svelte'
  import FormModal from '../ui/FormModal.svelte'

  export let name = ''
  export let selectedType = 'md'
  export let nameError = false

  let input: HTMLInputElement

  const dispatch = createEventDispatcher<{ add: void; cancel: void }>()

  onMount(async () => {
    await tick()
    input?.focus()
  })
</script>

<FormModal modalClass="add-modal" title={$t('notesList.addEntryTitle')} ariaLabel={$t('common.close')} on:close={() => dispatch('cancel')}>
  <input
    class="modal-field"
    class:field-error={nameError}
    type="text"
    placeholder={$t('notesList.entryNamePlaceholder')}
    bind:this={input}
    bind:value={name}
    on:keydown={(event) => event.key === 'Enter' && dispatch('add')}
  />
  <FileTypeGrid bind:value={selectedType} />
  <svelte:fragment slot="actions">
    <button class="btn" on:click={() => dispatch('cancel')}>{$t('common.cancel')}</button>
    <button class="btn primary" on:click={() => dispatch('add')}>{$t('common.add')}</button>
  </svelte:fragment>
</FormModal>
