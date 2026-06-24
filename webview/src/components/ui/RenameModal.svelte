<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte'
  import { t } from '../../i18n'
  import FormModal from './FormModal.svelte'

  export let title = ''
  export let body = ''
  export let value = ''

  let input: HTMLInputElement

  const dispatch = createEventDispatcher<{ save: void; cancel: void }>()

  onMount(async () => {
    await tick()
    input?.focus()
    input?.select()
  })
</script>

<FormModal modalClass="delete-modal" {title} ariaLabel="Close rename dialog" on:close={() => dispatch('cancel')}>
  <p>{body}</p>
  <input
    class="form-input"
    type="text"
    bind:this={input}
    bind:value
    placeholder={$t('common.name')}
    on:keydown={(event) => event.key === 'Enter' && dispatch('save')}
  />
  <svelte:fragment slot="actions">
    <button class="btn" on:click={() => dispatch('cancel')}>{$t('common.cancel')}</button>
    <button class="btn primary" on:click={() => dispatch('save')}>{$t('common.save')}</button>
  </svelte:fragment>
</FormModal>
