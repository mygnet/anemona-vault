<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let icon = ''
  export let label = ''
  export let danger = false

  const dispatch = createEventDispatcher<{ select: void }>()
</script>

<button class="menu-item" class:danger on:click|stopPropagation={() => dispatch('select')}>
  {#if icon}
    <span class="anemona {icon}"></span>
  {/if}
  <span>{label}</span>
</button>
