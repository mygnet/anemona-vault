<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let title = ''
  export let ariaLabel = 'Close'
  export let modalClass = 'form-modal'

  const dispatch = createEventDispatcher<{ close: void }>()
</script>

<button class="modal-backdrop" on:click={() => dispatch('close')} aria-label={ariaLabel}></button>
<div class={modalClass}>
  {#if title}
    <h3>{title}</h3>
  {/if}
  <slot />
  <div class="form-actions">
    <slot name="actions" />
  </div>
</div>
