<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { generateDeleteCode } from '../lib/utils'
  import { t } from '../i18n'

  export let show = false
  export let title = ''
  export let itemName = ''

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>()

  let code = ''
  let codeInput = ''
  let codeError = false
  let errorMessage = ''
  let errorTimer: ReturnType<typeof setTimeout> | null = null

  function reset() {
    code = generateDeleteCode()
    codeInput = ''
    codeError = false
    errorMessage = ''
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = null
  }

  $: if (show) reset()

  function showError(msg: string) {
    errorMessage = msg
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { errorMessage = '' }, 5000)
  }

  function confirm() {
    const trimmed = codeInput.trim().toUpperCase()
    if (trimmed === '') {
      codeError = true
      return
    }
    if (trimmed !== code) {
      codeError = true
      showError($t('app.codeMismatch'))
      return
    }
    dispatch('confirm')
  }

  function cancel() {
    if (errorTimer) clearTimeout(errorTimer)
    errorTimer = null
    dispatch('cancel')
  }
</script>

{#if show}
  <button class="delete-modal-backdrop" on:click={cancel} aria-label="Close"></button>
  <div class="delete-modal">
    <h3>{title}</h3>
    <p>{$t('common.deleteConfirmBody', { title: itemName, code })}</p>
    <!-- svelte-ignore a11y-autofocus -->
    <input
      class="delete-code-input"
      class:field-error={codeError}
      type="text"
      bind:value={codeInput}
      maxlength="4"
      placeholder={$t('common.code')}
      autofocus
      on:keydown={(event) => event.key === 'Enter' && confirm()}
      on:input={() => { codeError = false; errorMessage = '' }}
    />
    <div class="delete-modal-actions">
      <button class="btn small" on:click={cancel}>{$t('common.cancel')}</button>
      <button class="btn small danger" on:click={confirm}>{$t('common.delete')}</button>
    </div>
  </div>

  {#if errorMessage}
    <div class="delete-code-toast">{errorMessage}</div>
  {/if}
{/if}
