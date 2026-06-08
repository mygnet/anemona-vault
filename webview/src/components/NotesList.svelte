<script lang="ts">
  import { smartPopover } from "../utils/smartPopover";

  export let notes: {
    name: string;
    filePath: string;
    fileType?: string;
    displayName?: string;
    icon?: string;
  }[] = [];
  export let selectedCategory = "";
  export let selectedCategoryConfig: { color?: string; icon?: string } = {};
  export let canDeleteCategory = false;
  export let onSelect: (note: { name: string; filePath: string }) => void;
  export let onCreate: (title: string, fileType: string) => void;
  export let onDelete: (note: { name: string; filePath: string }) => void;
  export let onDeleteCategory: (category: string) => void;
  export let onRename: (note: { name: string; filePath: string }) => void;
  export let onRenameCategory: (category: string) => void;
  export let onUpdateCategoryColor: (category: string, color: string) => void;

  let newNoteName = "";
  let showInput = false;
  let selectedType: string = "md";
  let isCategoryMenuOpen = false;
  let activeNoteMenu: string | null = null;

  const categoryColors = [
    {
      value: "vscode-default",
      swatch: "var(--vscode-sideBarTitle-foreground)",
      title: "VS Code default",
    },
    {
      value: "vscode-muted",
      swatch:
        "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)",
      title: "VS Code muted",
    },
    {
      value: "vscode-soft",
      swatch: "var(--vscode-editor-background)",
      title: "VS Code surface",
    },
    { value: "#fc5c65", swatch: "#fc5c65", title: "Red" },
    { value: "#fd9644", swatch: "#fd9644", title: "Orange" },
    { value: "#fed330", swatch: "#fed330", title: "Gold" },
    { value: "#26de81", swatch: "#26de81", title: "Green" },
    { value: "#2bcbba", swatch: "#2bcbba", title: "Turquoise" },
    { value: "#eb3b5a", swatch: "#eb3b5a", title: "Crimson" },
    { value: "#fa8231", swatch: "#fa8231", title: "Tangerine" },
    { value: "#f7b731", swatch: "#f7b731", title: "Amber" },
    { value: "#20bf6b", swatch: "#20bf6b", title: "Emerald" },
    { value: "#0fb9b1", swatch: "#0fb9b1", title: "Teal" },
    { value: "#45aaf2", swatch: "#45aaf2", title: "Sky" },
    { value: "#4b7bec", swatch: "#4b7bec", title: "Blue" },
    { value: "#a55eea", swatch: "#a55eea", title: "Purple" },
    { value: "#d1d8e0", swatch: "#d1d8e0", title: "Silver" },
    { value: "#778ca3", swatch: "#778ca3", title: "Steel" },
    { value: "#2d98da", swatch: "#2d98da", title: "Ocean" },
    { value: "#3867d6", swatch: "#3867d6", title: "Royal blue" },
    { value: "#8854d0", swatch: "#8854d0", title: "Violet" },
    { value: "#a5b1c2", swatch: "#a5b1c2", title: "Cloud" },
    { value: "#4b6584", swatch: "#4b6584", title: "Slate" },
  ];

  const systemCategoryColors = categoryColors.slice(0, 3);
  const customCategoryColors = categoryColors.slice(3);

  function select(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onSelect(note);
  }

  function create() {
    if (newNoteName.trim()) {
      onCreate(newNoteName.trim(), selectedType);
      newNoteName = "";
      showInput = false;
    }
  }

  function toggleInput() {
    showInput = !showInput;
    isCategoryMenuOpen = false;
    activeNoteMenu = null;
    if (showInput) {
      setTimeout(() => {
        const input = document.querySelector(
          ".new-note-input",
        ) as HTMLInputElement;
        input?.focus();
      }, 50);
    }
  }

  function requestDeleteCategory() {
    isCategoryMenuOpen = false;
    onDeleteCategory(selectedCategory);
  }

  function requestRenameCategory() {
    isCategoryMenuOpen = false;
    onRenameCategory(selectedCategory);
  }

  function updateCategoryColor(color: string) {
    onUpdateCategoryColor(selectedCategory, color);
    isCategoryMenuOpen = false;
  }

  function toggleCategoryMenu() {
    isCategoryMenuOpen = !isCategoryMenuOpen;
    activeNoteMenu = null;
  }

  function toggleNoteMenu(notePath: string) {
    activeNoteMenu = activeNoteMenu === notePath ? null : notePath;
    isCategoryMenuOpen = false;
  }

  function requestRenameFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onRename(note);
  }

  function requestDeleteFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onDelete(note);
  }

  function getIconClass(note: { fileType?: string; name?: string }): string {
    if (note.name?.endsWith(".anemona-lock")) return "icon-file-lock";
    if (note.fileType === "key") return "icon-file-key";
    if (note.fileType === "command") return "icon-file-terminal";
    if (note.fileType === "todo") return "icon-list-todo";
    return "icon-file-text";
  }

  function closeCategoryMenu() {
    isCategoryMenuOpen = false;
  }

  function closeNoteMenu() {
    activeNoteMenu = null;
  }
</script>

<div class="notes-list">
  <div class="header">
    <div class="title-row">
      <span class="title">{selectedCategory}</span>
    </div>
    <div class="header-actions">
      <button
        class="icon-btn primary-action"
        on:click={toggleInput}
        title="New note"><span class="anemona icon-plus"></span></button
      >
      <div class="menu-wrap" class:menu-open={isCategoryMenuOpen}>
        <button
          class="icon-btn menu-trigger"
          on:click={toggleCategoryMenu}
          title="Category options"
          ><span class="anemona icon-menu"></span></button
        >
        {#if isCategoryMenuOpen}
          <div
            class="menu-popover category-menu"
            use:smartPopover={{
              open: isCategoryMenuOpen,
              onClose: closeCategoryMenu,
            }}
          >
            <button class="menu-item" on:click={requestRenameCategory}
              ><span class="anemona icon-edit-alt"></span><span>Rename</span
              ></button
            >
            {#if canDeleteCategory}
              <button class="menu-item danger" on:click={requestDeleteCategory}
                ><span class="anemona icon-trash-alt"></span><span>Delete</span
                ></button
              >
            {/if}
            <!-- <div class="menu-section-label">Color</div> -->
            <div class="menu-section-label"></div>
            <div class="color-grid system-colors">
              {#each systemCategoryColors as color}
                <button
                  class="color-swatch"
                  class:active={selectedCategoryConfig.color === color.value}
                  style={`--swatch:${color.swatch}`}
                  on:click={() => updateCategoryColor(color.value)}
                  title={color.title}
                ></button>
              {/each}
            </div>
            <div class="color-divider"></div>
            <div class="color-grid custom-colors">
              {#each customCategoryColors as color}
                <button
                  class="color-swatch"
                  class:active={selectedCategoryConfig.color === color.value}
                  style={`--swatch:${color.swatch}`}
                  on:click={() => updateCategoryColor(color.value)}
                  title={color.title}
                ></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if showInput}
    <div class="new-note">
      <input
        class="new-note-input"
        type="text"
        placeholder="Title"
        bind:value={newNoteName}
        on:keydown={(e) => e.key === "Enter" && create()}
      />
      <select class="type-select" bind:value={selectedType}>
        <option value="md">Text</option>
        <option value="key">Key</option>
        <option value="command">Cmd</option>
        <option value="todo">Todo</option>
      </select>
      <button class="icon-btn" on:click={create} title="Create"
        ><span class="anemona icon-check"></span></button
      >
      <button class="icon-btn" on:click={toggleInput} title="Cancel"
        ><span class="anemona icon-x"></span></button
      >
    </div>
  {/if}

  {#if notes.length === 0}
    <p class="empty-msg">No notes yet</p>
  {:else}
    {#each notes as note}
      <div class="note-item">
        <button class="note-btn" on:click={() => select(note)}>
          <span class={`note-icon anemona ${getIconClass(note)}`}></span>
          <span class="note-name">{note.displayName || note.name}</span>
        </button>
        <div class="note-actions">
          <div
            class="menu-wrap"
            class:menu-open={activeNoteMenu === note.filePath}
          >
            <button
              class="icon-btn note-action-btn"
              on:click|stopPropagation={() => toggleNoteMenu(note.filePath)}
              title="File options"
              ><span class="anemona icon-dots-vertical"></span></button
            >
            {#if activeNoteMenu === note.filePath}
              <div
                class="menu-popover note-menu"
                use:smartPopover={{
                  open: activeNoteMenu === note.filePath,
                  onClose: closeNoteMenu,
                }}
              >
                <button
                  class="menu-item"
                  on:click|stopPropagation={() => requestRenameFromMenu(note)}
                  ><span class="anemona icon-edit-alt"></span><span>Rename</span
                  ></button
                >
                <button
                  class="menu-item danger"
                  on:click|stopPropagation={() => requestDeleteFromMenu(note)}
                  ><span class="anemona icon-trash-alt"></span><span
                    >Delete</span
                  ></button
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .notes-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 0.12rem 0.18rem 0.24rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 0.16rem;
    flex-shrink: 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    margin-bottom: 0.16rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.12rem;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.12rem;
  }

  .title {
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    opacity: 0.95;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .primary-action {
    color: color-mix(
      in srgb,
      var(--accent-color, var(--vscode-textLink-foreground)) 82%,
      white 18%
    );
  }

  .menu-wrap {
    position: relative;
    z-index: 0;
  }

  .menu-wrap.menu-open {
    z-index: 20;
  }

  .new-note {
    display: flex;
    gap: 0.14rem;
    padding: 0 0 0.24rem;
    align-items: center;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .new-note-input {
    flex: 1;
    min-width: 60px;
    background: color-mix(
      in srgb,
      var(--accent-color) 3%,
      var(--vscode-input-background)
    );
    color: var(--vscode-input-foreground);
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--vscode-input-border));
    padding: 0.24rem 0.32rem;
    font-size: var(--ui-font-sm);
    outline: none;
    border-radius: var(--ui-radius-sm);
  }

  .new-note-input:focus {
    border-color: color-mix(
      in srgb,
      var(--accent-color) 38%,
      var(--vscode-focusBorder)
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .type-select {
    background: color-mix(
      in srgb,
      var(--accent-color) 3%,
      var(--vscode-dropdown-background)
    );
    color: var(--vscode-dropdown-foreground);
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--vscode-dropdown-border));
    padding: 0.22rem 0.28rem;
    font-size: var(--ui-font-xs);
    outline: none;
    cursor: pointer;
    border-radius: var(--ui-radius-sm);
  }

  .type-select:focus {
    border-color: color-mix(
      in srgb,
      var(--accent-color) 38%,
      var(--vscode-focusBorder)
    );
  }

  .empty-msg {
    padding: 0.54rem 0.38rem;
    text-align: center;
    color: var(--ui-muted);
    font-size: var(--ui-font-sm);
    border: 1px dashed var(--ui-border);
    border-radius: var(--ui-radius-md);
    background: color-mix(
      in srgb,
      var(--vscode-editor-background) 72%,
      transparent
    );
  }

  .note-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    transition:
      background 0.14s,
      border-color 0.14s,
      border-color 0.14s;
  }

  .note-item:hover {
    background: color-mix(in srgb, var(--accent-color) 6%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .note-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.16rem;
    background: none;
    border: none;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: var(--ui-font-sm);
    padding: 0.2rem 0.26rem;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.78;
  }

  .note-btn:hover {
    opacity: 1;
  }

  .note-icon {
    font-size: 0.9em;
    flex-shrink: 0;
    opacity: 0.92;
  }

  .note-name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    letter-spacing: 0;
  }

  .note-actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    margin-right: 0.12rem;
  }

  .note-action-btn {
    opacity: 0.55;
    font-size: 1em;
  }

  .icon-btn {
    background: color-mix(
      in srgb,
      var(--vscode-editor-background) 96%,
      white 4%
    );
    border: 1px solid color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.72em;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 14%, transparent);
  }

  .menu-popover {
    position: absolute;
    top: calc(100% + 0.16rem);
    bottom: auto;
    left: auto;
    right: 0;
    min-width: 6.9rem;
    max-width: min(var(--popover-max-width, 20rem), calc(100vw - 1rem));
    max-height: var(--popover-max-height, 24rem);
    overflow-y: auto;
    background: color-mix(
      in srgb,
      var(--vscode-editor-background) 97%,
      white 3%
    );
    border: 1px solid var(--ui-border-strong);
    border-radius: 6px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    padding: 0.12rem;
    z-index: 12;
  }

  :global(.menu-popover[data-vertical="up"]) {
    top: auto;
    bottom: calc(100% + 0.16rem);
  }

  :global(.menu-popover[data-horizontal="left"]) {
    left: 0;
    right: auto;
  }

  .category-menu {
    width: 8.5rem;
  }

  .note-menu {
    min-width: 6.9rem;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.34rem;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    border-radius: 0;
    padding: 0.22rem 0.28rem;
    cursor: pointer;
    font-size: 0.64rem;
    text-align: left;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .menu-item.danger {
    color: #e87070;
  }

  .menu-section-label {
    padding: 0.14rem 0 0.08rem;
    font-size: var(--ui-font-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ui-muted);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    padding: 0;
    justify-items: stretch;
    align-items: stretch;
  }

  .color-grid.system-colors {
    grid-template-columns: repeat(3, 1fr);
    padding-bottom: 0;
  }

  .color-grid.custom-colors {
    padding-top: 0;
  }

  .color-divider {
    display: none;
  }

  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    height: auto;
    border-radius: 0;
    border: 1px solid color-mix(in srgb, var(--swatch) 70%, white 30%);
    background: var(--swatch);
    cursor: pointer;
    box-shadow: none;
    transition:
      outline-color 0.12s ease,
      filter 0.12s ease;
  }

  .color-swatch:hover {
    filter: brightness(1.08);
  }

  .color-swatch.active {
    outline: 2px solid
      color-mix(in srgb, var(--vscode-focusBorder) 78%, white 22%);
    outline-offset: -2px;
  }
</style>
