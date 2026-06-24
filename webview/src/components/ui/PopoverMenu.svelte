<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { smartPopover } from '../../utils/smartPopover'

  export let open = false
  export let title = ''
  export let triggerClass = 'icon-action'

  const dispatch = createEventDispatcher<{ toggle: void; close: void }>()
</script>

<div class="menu-wrap" class:menu-open={open}>
  <button
    class={triggerClass}
    on:click|stopPropagation={() => dispatch('toggle')}
    {title}
  >
    <span class="anemona icon-dots-vertical"></span>
  </button>
  {#if open}
    <div class="menu-popover" use:smartPopover={{ open, onClose: () => dispatch('close') }}>
      <slot />
    </div>
  {/if}
</div>
