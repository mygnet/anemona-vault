<script lang="ts">
  import { t } from '../../i18n'
  import { resolveColorValue } from '../../utils/fileUtils'
  export let categories: {
    name: string;
    path: string;
    config?: { color?: string; icon?: string };
  }[] = [];
  export let selectedCategory = "";
  export let collapsed = false;
  export let onSelect: (category: string) => void;
  export let onCreateCategory: (name: string) => void;
  export let onToggleCollapse: () => void;
  export let notificationCount = 0;
  export let onShowNotifications: () => void = () => {};

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

  function getTabStyle(color?: string): string {
    const isSurface = !color || color === "vscode-soft";
    const tabColor = isSurface
      ? "var(--vscode-editor-background)"
      : resolveColorValue(color, 'var(--vscode-sideBarTitle-foreground)');
    const tabText = isSurface ? "var(--vscode-foreground)" : "";
    const tabStyle = `--tab-color: ${tabColor}`;
    return tabText ? `${tabStyle}; --tab-text: ${tabText}` : tabStyle;
  }

  function getShortLabel(name: string): string {
    return name.trim().charAt(0).toUpperCase();
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
          <button class="icon-btn side-tool" on:click={addCategory} title={$t('common.add')}
            ><span class="anemona icon-check"></span></button
          >
          <button
            class="icon-btn side-tool"
            on:click={toggleInput}
            title={$t('common.cancel')}><span class="anemona icon-x"></span></button
          >
        {:else}
          <button
            class="icon-btn side-tool"
            on:click={toggleCollapsed}
            title={collapsed ? $t('category.showCategories') : $t('category.hideCategories')}
          >
            <span
              class={`anemona ${collapsed ? "icon-chevron-right" : "icon-chevron-left"}`}
            ></span>
          </button>
          <button
            class="icon-btn side-tool notif-trigger"
            on:click={onShowNotifications}
            title={$t('category.notifications', { count: String(notificationCount) })}>
            <span class="anemona icon-bell"></span>
            {#if notificationCount > 0}
              <span class="notif-side-badge ui-badge count tiny filled danger">{notificationCount > 99 ? '99+' : notificationCount}</span>
            {/if}
          </button>
          {#if !collapsed}
            <button
              class="icon-btn side-tool add-cat"
              on:click={toggleInput}
              title={$t('category.addCategory')}
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
          placeholder={$t('category.namePlaceholder')}
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
        style={getTabStyle(cat.config?.color)}
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
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 80px;
    min-width: 80px;
    overflow: visible;
    flex-shrink: 0;
    background: var(--theme-layout-sidebar-bg);
    position: relative;
    z-index: 2;
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

  .sidebar-frame::after {
    content: '';
    display: block;
    height: 1px;
    background: var(--theme-layout-sidebar-divider);
    margin: 0 0.2rem;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem 0 0.12rem;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    justify-content: center;
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
    background: var(--theme-editor-field-bg);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--theme-editor-field-border);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) var(--ui-control-pad-x);
    font-size: var(--ui-font-control);
    outline: none;
    box-sizing: border-box;
    border-radius: var(--ui-radius-sm);
  }

  .new-cat-input:focus {
    border-color: var(--theme-editor-card-border-hover);
  }

  .tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.06rem;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.18rem 0 0.2rem 0.08rem;
    margin-right: calc(var(--theme-tabs-active-overlap) * -1);
    scrollbar-width: thin;
  }

  .tabs.collapsed-tabs {
    padding: 0.18rem 0 0.2rem 0.03rem;
    margin-right: calc(var(--theme-tabs-active-overlap) * -1);
    align-items: stretch;
  }

  .tab {
    --tab-text: color-mix(in srgb, var(--tab-color) var(--tab-text-intensity, 78%), black);
    display: flex;
    align-items: center;
    gap: 0.16rem;
    width: calc(100% - var(--theme-tabs-active-overlap));
    padding: 0.2rem 0.2rem 0.2rem 0.18rem;
    border: 1px solid transparent;
    border-right: 1px solid transparent;
    border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition:
      background 0.14s,
      border-color 0.14s,
      transform 0.14s;
    font-size: var(--ui-font-entry);
    color: var(--tab-text);
    min-width: 0;
    position: relative;
  }

  .tab.compact {
    width: calc(100% - var(--theme-tabs-active-overlap));
    justify-content: center;
    padding: 0.2rem 0.04rem;
    border-right: 1px solid transparent;
    border-radius: var(--ui-radius-lg) 0 0 var(--ui-radius-lg);
    transform: none;
  }

  .tab::before {
    content: "";
    width: 0.12rem;
    align-self: stretch;
    border-radius: var(--theme-radius-pill);
    background: color-mix(in srgb, var(--tab-color) var(--theme-tabs-indicator-opacity), transparent);
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
    background: var(--theme-tabs-hover-bg);
    border-color: var(--theme-tabs-hover-border);
    transform: translateX(1px);
  }

  .tab.compact:hover {
    transform: none;
  }

  .tab.compact.active:hover {
    transform: none;
  }

  .tab.active {
    width: 100%;
    background: var(--theme-tabs-active-bg);
    border-color: var(--theme-tabs-active-border);
    border-right-color: transparent;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    color: var(--tab-text);
    font-weight: var(--theme-tabs-active-weight);
    transform: none;
    z-index: 2;
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

  .notif-trigger {
    position: relative;
  }

  .notif-side-badge {
    position: absolute;
    top: -1px;
    right: -1px;
    pointer-events: none;
    box-sizing: border-box;
  }
</style>
