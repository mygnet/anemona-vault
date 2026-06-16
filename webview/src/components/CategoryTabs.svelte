<script lang="ts">
  export let categories: {
    name: string;
    path: string;
    config?: { color?: string; icon?: string };
  }[] = [];
  export let selectedCategory = "";
  export let collapsed = false;
  export let onSelect: (category: string) => void;
  export let onCreateCategory: (name: string) => void;
  export let onRenameCategory: (category: string) => void;
  export let onToggleCollapse: () => void;

  let newCategoryName = "";
  let showInput = false;

  function select(category: string) {
    onSelect(category);
  }

  function handleTabKeydown(event: KeyboardEvent, category: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(category);
    }
  }

  function addCategory() {
    if (newCategoryName.trim()) {
      onCreateCategory(newCategoryName.trim());
      newCategoryName = "";
      showInput = false;
    }
  }

  function focusNewCategoryInput() {
    setTimeout(() => {
      const input = document.querySelector(
        ".new-cat-input",
      ) as HTMLInputElement;
      input?.focus();
    }, 50);
  }

  function toggleInput() {
    if (collapsed && !showInput) {
      showInput = true;
      onToggleCollapse();
      focusNewCategoryInput();
      return;
    }

    showInput = !showInput;
    if (showInput) {
      focusNewCategoryInput();
    }
  }

  function getColor(config?: { color?: string; icon?: string }): string {
    switch (config?.color) {
      case "vscode-default":
        return "var(--vscode-sideBarTitle-foreground)";
      case "vscode-muted":
        return "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)";
      case "vscode-soft":
        return "var(--vscode-editor-background)";
      default:
        return config?.color || "var(--vscode-sideBarTitle-foreground)";
    }
  }

  function getShortLabel(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }

  function renameCategory(category: string, event: MouseEvent) {
    event.stopPropagation();
    onRenameCategory(category);
  }

  function toggleCollapsed() {
    if (showInput) {
      showInput = false;
      newCategoryName = "";
    }
    onToggleCollapse();
  }
</script>

<div class="sidebar" class:collapsed>
  <div class="sidebar-frame">
    <div class="sidebar-header">
      <div class="header-actions" class:stacked={collapsed}>
        {#if showInput && !collapsed}
          <button class="icon-btn side-tool" on:click={addCategory} title="Add"
            ><span class="anemona icon-check"></span></button
          >
          <button
            class="icon-btn side-tool"
            on:click={toggleInput}
            title="Cancel"><span class="anemona icon-x"></span></button
          >
        {:else}
          <button
            class="icon-btn side-tool"
            on:click={toggleCollapsed}
            title={collapsed ? "Show categories" : "Hide categories"}
          >
            <span
              class={`anemona ${collapsed ? "icon-chevron-right" : "icon-chevron-left"}`}
            ></span>
          </button>
          {#if !collapsed}
            <button
              class="icon-btn side-tool add-cat"
              on:click={toggleInput}
              title="Add category"
              ><span class="anemona icon-plus"></span></button
            >
          {/if}
        {/if}
      </div>
    </div>

    {#if showInput && !collapsed}
      <div class="new-category">
        <input
          class="new-cat-input"
          type="text"
          placeholder="Name"
          bind:value={newCategoryName}
          on:keydown={(e) => e.key === "Enter" && addCategory()}
          on:blur={() => {
            if (!newCategoryName) showInput = false;
          }}
        />
      </div>
    {/if}
  </div>

  <div class="tabs" class:collapsed-tabs={collapsed}>
    {#each categories as cat}
      <div
        class="tab"
        class:active={cat.name === selectedCategory}
        class:compact={collapsed}
        style="--tab-color: {getColor(cat.config)}"
        on:click={() => select(cat.name)}
        on:keydown={(event) => handleTabKeydown(event, cat.name)}
        role="button"
        tabindex="0"
        title={cat.name}
      >
        {#if collapsed}
          <span class="tab-initial">{getShortLabel(cat.name)}</span>
        {:else}
          {#if cat.config?.icon}
            <span class="tab-icon">{cat.config.icon}</span>
          {/if}
          <span class="tab-label">{cat.name}</span>
          {#if cat.name === selectedCategory}
            <!-- <button class="tab-action" on:click={(event) => renameCategory(cat.name, event)} title="Rename category"><span class="anemona icon-edit-alt"></span></button> -->
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 60px;
    min-width: 60px;
    overflow: hidden;
    flex-shrink: 0;
    background: color-mix(
      in srgb,
      var(--vscode-sideBar-background) 96%,
      black 4%
    );
    position: relative;
    transition:
      width 0.18s ease,
      min-width 0.18s ease;
  }

  .sidebar.collapsed {
    width: 30px;
    min-width: 30px;
  }

  .sidebar-frame {
    position: relative;
    flex-shrink: 0;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.14rem;
    padding: 0.2rem 0.14rem 0.12rem;
    flex-shrink: 0;
  }

  .sidebar.collapsed .sidebar-header {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    min-width: 0;
  }

  .header-actions.stacked {
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .side-tool {
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
  }

  .sidebar.collapsed .add-cat {
    margin-top: 0.12rem;
  }

  .new-category {
    padding: 0 0.16rem 0.18rem;
    flex-shrink: 0;
  }

  .new-cat-input {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) var(--ui-control-pad-x);
    font-size: var(--ui-font-control);
    outline: none;
    box-sizing: border-box;
    border-radius: var(--ui-radius-sm);
  }

  .new-cat-input:focus {
    border-color: var(--vscode-focusBorder);
  }

  .tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.06rem;
    overflow-y: auto;
    padding: 0.04rem 0 0.2rem 0.08rem;
    scrollbar-width: thin;
  }

  .tabs.collapsed-tabs {
    padding: 0.04rem 0 0.2rem 0.03rem;
    align-items: stretch;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.16rem;
    width: calc(100% + 0.06rem);
    padding: 0.2rem 0.2rem 0.2rem 0.18rem;
    border: 1px solid transparent;
    border-right: none;
    border-radius: 0 8px 8px 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition:
      background 0.14s,
      border-color 0.14s,
      transform 0.14s;
    font-size: var(--ui-font-entry);
    color: var(--vscode-sideBarTitle-foreground);
    min-width: 0;
    position: relative;
  }

  .tab.compact {
    width: 100%;
    justify-content: center;
    padding: 0.2rem 0.04rem;
    border-right: 1px solid transparent;
    border-radius: 8px 0 0 8px;
    transform: none;
  }

  .tab::before {
    content: "";
    width: 0.12rem;
    align-self: stretch;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tab-color) 62%, transparent);
    opacity: 0.74;
    flex-shrink: 0;
  }

  .tab.compact::before {
    width: 0.14rem;
    margin-right: 0.06rem;
  }

  .tab-icon {
    font-size: 1em;
    flex-shrink: 0;
  }

  .tab-initial {
    line-height: 1;
    text-transform: uppercase;
  }

  .tab-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab:hover {
    background: color-mix(in srgb, var(--tab-color) 7%, transparent);
    border-color: color-mix(in srgb, var(--tab-color) 16%, transparent);
    transform: translateX(1px);
  }

  .tab.compact:hover {
    transform: none;
  }

  .tab.active {
    background: color-mix(
      in srgb,
      var(--tab-color) 14%,
      var(--vscode-editor-background)
    );
    border-color: color-mix(in srgb, var(--tab-color) 24%, transparent);
    color: var(--vscode-sideBarTitle-foreground);
    font-weight: 500;
    transform: translateX(1px);
  }

  .tab.active::before {
    background: var(--tab-color);
    opacity: 0.95;
  }

  .tab.compact.active {
    transform: none;
    box-shadow: none;
  }

  .tab.active .tab-label {
    letter-spacing: 0;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.82em;
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    opacity: 0.88;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    opacity: 1;
    color: var(--vscode-textLink-foreground);
    background: color-mix(
      in srgb,
      var(--accent-color, var(--vscode-textLink-foreground)) 10%,
      transparent
    );
    border-color: transparent;
  }

  .icon-btn:focus-visible {
    outline: 1px solid color-mix(in srgb, var(--accent-color, var(--vscode-textLink-foreground)) 45%, transparent);
    outline-offset: 1px;
  }

  .add-cat {
    font-size: 0.95em;
  }
</style>
