<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { t } from "../../i18n";

  export let segments: string[] = [];
  export let categoryPath = "";
  export let dragOverPath: string | null = null;

  const dispatch = createEventDispatcher<{
    navigate: number;
    dragOver: { event: DragEvent; path: string };
    dragEnter: { event: DragEvent; path: string };
    dragLeave: void;
    drop: { event: DragEvent; path: string };
  }>();

  $: parentSegments = segments.slice(0, -1);
</script>

{#if segments.length > 0}
  <div class="breadcrumb">
    <button
      class="breadcrumb-item"
      class:drag-over={dragOverPath === categoryPath}
      aria-label={$t("notesList.root")}
      on:click={() => dispatch("navigate", -1)}
      on:dragover={(event) =>
        dispatch("dragOver", { event, path: categoryPath })}
      on:dragenter={(event) =>
        dispatch("dragEnter", { event, path: categoryPath })}
      on:dragleave={() => dispatch("dragLeave")}
      on:drop={(event) => dispatch("drop", { event, path: categoryPath })}
    >
      <span class="icon-btn anemona icon-home"></span>
      {#if parentSegments.length === 0}
        {$t("breadcrumb.home")}
      {/if}
    </button>
    {#each parentSegments as segment, index}
      {@const segmentPath =
        categoryPath + "/" + segments.slice(0, index + 1).join("/")}
      <span class="breadcrumb-sep">/</span>
      <button
        class="breadcrumb-item"
        class:drag-over={dragOverPath === segmentPath}
        on:click={() => dispatch("navigate", index)}
        on:dragover={(event) =>
          dispatch("dragOver", { event, path: segmentPath })}
        on:dragenter={(event) =>
          dispatch("dragEnter", { event, path: segmentPath })}
        on:dragleave={() => dispatch("dragLeave")}
        on:drop={(event) => dispatch("drop", { event, path: segmentPath })}
      >
        {segment}
      </button>
    {/each}
  </div>
{/if}

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.08rem;
    padding: 0.12rem 0.18rem;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    border-bottom: 1px solid var(--theme-accent-border);
    flex-shrink: 0;
    overflow-x: auto;
    white-space: nowrap;
  }

  .breadcrumb-item {
    background: none;
    border: none;
    color: var(--theme-accent-text);
    cursor: pointer;
    font-size: var(--ui-font-xs);
    padding: 0.06rem 0.1rem;
    border-radius: var(--ui-radius-sm);
    opacity: 0.75;
  }

  .breadcrumb-item:hover {
    opacity: 1;
    background: var(--theme-accent-hover);
  }

  .breadcrumb-item.drag-over {
    background: var(--theme-accent-active) !important;
    color: var(--theme-accent-text) !important;
    box-shadow: inset 0 0 0 1px var(--theme-accent-border-strong);
  }

  .breadcrumb-sep {
    opacity: 0.4;
  }
</style>
